import { NextResponse } from 'next/server';
import { getStripeInstance } from '@/utils/stripe';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';

// Import the PRICE_IDs from environment variables
const PRICE_IDS = {
  premium: process.env.STRIPE_PREMIUM_PLAN_PRICE_ID || '',
  premium_annual: process.env.STRIPE_PREMIUM_ANNUAL_PLAN_PRICE_ID || '',
};

// Set the runtime to nodejs to avoid Edge Runtime issues with cookies
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    // Initialize Supabase client inside the handler
    const supabase = await createClient();

    // Get the request body
    const body = await request.json();
    const { userId, forceUpdate } = body;
    
    // Validate the user ID
    let validatedUserId = userId;
    
    if (!validatedUserId) {
      // Try to get the user ID from the authorization header
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        // Extract the token from the Authorization header
        const token = authHeader.replace('Bearer ', '');
        
        try {
          // Verify the token
          const { data: { user }, error } = await supabase.auth.getUser(token);
          
          if (error || !user) {
            console.error('Error verifying token:', error);
            return new NextResponse('Unauthorized - Invalid token', { status: 401 });
          }
          
          // Use the user ID from the token
          validatedUserId = user.id;
        } catch (error) {
          console.error('Error verifying token:', error);
          return new NextResponse('Unauthorized - Invalid token', { status: 401 });
        }
      } else {
        return new NextResponse('Unauthorized - No user ID provided', { status: 401 });
      }
    }
    
    console.log(`Processing subscription update for user ${validatedUserId}`);
    
    // Get the user's subscription
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', validatedUserId)
      .single();

    if (subscriptionError && subscriptionError.code !== 'PGRST116') {
      console.error('Error fetching subscription:', subscriptionError);
      return new NextResponse('Error fetching subscription', { status: 500 });
    }

    // If no subscription found, create a default one
    if (!subscription) {
      console.log(`No subscription found for user ${validatedUserId}, creating default`);
      const { error: insertError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: validatedUserId,
          status: 'active',
          plan_type: 'free',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Error creating default subscription:', insertError);
        
        // Check if this is an RLS policy error
        if (insertError.code === '42501' || (insertError.message && insertError.message.includes('row-level security policy'))) {
          console.log('RLS policy prevented creating subscription, returning fallback response');
          
          // Return a fallback response with a client-side subscription
          return NextResponse.json({
            success: true,
            message: 'Using fallback subscription due to RLS policy restrictions',
            subscription: {
              id: `fallback-api-${validatedUserId}`,
              user_id: validatedUserId,
              status: 'active',
              plan_type: 'free',
              stripe_customer_id: null,
              stripe_subscription_id: null,
              stripe_price_id: null,
              current_period_start: null,
              current_period_end: null,
              cancel_at_period_end: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            rls_error: true
          });
        }
        
        return new NextResponse('Error creating default subscription', { status: 500 });
      }
      
      return NextResponse.json({
        success: true,
        message: 'Default subscription created',
        subscription: {
          user_id: validatedUserId,
          status: 'active',
          plan_type: 'free',
        },
      });
    }

    // If the subscription has a Stripe customer ID, check for active subscriptions
    if (subscription?.stripe_customer_id) {
      try {
        const stripe = getStripeInstance();
        
        // Get all subscriptions for this customer
        const stripeSubscriptions = await stripe.subscriptions.list({
          customer: subscription.stripe_customer_id,
          status: 'active',
          expand: ['data.default_payment_method'],
        });
        
        console.log(`Found ${stripeSubscriptions.data.length} active subscriptions for customer ${subscription.stripe_customer_id}`);
        
        // If there's an active subscription, update the database
        if (stripeSubscriptions.data.length > 0) {
          const latestSubscription = stripeSubscriptions.data[0];
          const priceId = latestSubscription.items.data[0].price.id;
          
          // Determine plan type based on price ID
          let planType: 'free' | 'premium' = 'free';
          
          // Check if the price ID matches any of our premium plans
          if (priceId === PRICE_IDS.premium || priceId === PRICE_IDS.premium_annual) {
            planType = 'premium';
          }
          
          console.log(`Updating subscription for user ${validatedUserId} to plan ${planType}, price ID: ${priceId}`);
          
          const updateData = {
            stripe_subscription_id: latestSubscription.id,
            stripe_price_id: priceId,
            status: latestSubscription.status,
            plan_type: planType,
            current_period_start: new Date(latestSubscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(latestSubscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: latestSubscription.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          };
          
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update(updateData)
            .eq('user_id', validatedUserId);
            
          if (updateError) {
            console.error('Error updating subscription:', updateError);
            return new NextResponse('Error updating subscription', { status: 500 });
          }
          
          // Verify the update was successful
          const { data: verifySubscription } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', validatedUserId)
            .single();
            
          console.log('Updated subscription data:', JSON.stringify(verifySubscription));
          
          return NextResponse.json({
            success: true,
            message: 'Subscription updated successfully',
            subscription: verifySubscription,
          });
        } else {
          console.log(`No active Stripe subscriptions found for customer ${subscription.stripe_customer_id}`);
          
          // Check for pending or incomplete subscriptions
          const pendingSubscriptions = await stripe.subscriptions.list({
            customer: subscription.stripe_customer_id,
            status: 'all',
            expand: ['data.default_payment_method'],
          });
          
          if (pendingSubscriptions.data.length > 0) {
            console.log(`Found ${pendingSubscriptions.data.length} subscriptions (any status) for customer ${subscription.stripe_customer_id}`);
            
            // Find the most recent subscription
            const latestSubscription = pendingSubscriptions.data[0];
            console.log(`Latest subscription status: ${latestSubscription.status}`);
            
            // If it's incomplete, try to retrieve the latest invoice
            if (latestSubscription.status === 'incomplete') {
              const invoice = await stripe.invoices.retrieve(latestSubscription.latest_invoice as string);
              console.log(`Latest invoice status: ${invoice.status}`);
              
              // If the invoice is paid, update the subscription
              if (invoice.status === 'paid') {
                const priceId = latestSubscription.items.data[0].price.id;
                
                // Determine plan type based on price ID
                let planType: 'free' | 'premium' = 'free';
                
                // Check if the price ID matches any of our premium plans
                if (priceId === PRICE_IDS.premium || priceId === PRICE_IDS.premium_annual) {
                  planType = 'premium';
                }
                
                console.log(`Invoice is paid, updating subscription for user ${validatedUserId} to plan ${planType}`);
                
                const updateData = {
                  stripe_subscription_id: latestSubscription.id,
                  stripe_price_id: priceId,
                  status: 'active', // Force to active since invoice is paid
                  plan_type: planType,
                  current_period_start: new Date(latestSubscription.current_period_start * 1000).toISOString(),
                  current_period_end: new Date(latestSubscription.current_period_end * 1000).toISOString(),
                  cancel_at_period_end: latestSubscription.cancel_at_period_end,
                  updated_at: new Date().toISOString(),
                };
                
                const { error: updateError } = await supabase
                  .from('subscriptions')
                  .update(updateData)
                  .eq('user_id', validatedUserId);
                  
                if (updateError) {
                  console.error('Error updating subscription:', updateError);
                  return new NextResponse('Error updating subscription', { status: 500 });
                }
                
                // Verify the update was successful
                const { data: verifySubscription } = await supabase
                  .from('subscriptions')
                  .select('*')
                  .eq('user_id', validatedUserId)
                  .single();
                  
                console.log('Updated subscription data:', JSON.stringify(verifySubscription));
                
                return NextResponse.json({
                  success: true,
                  message: 'Subscription updated successfully from invoice',
                  subscription: verifySubscription,
                });
              }
            }
          }
          
          return NextResponse.json({
            success: false,
            message: 'No active subscriptions found',
            subscription,
          });
        }
      } catch (error) {
        console.error('Error checking Stripe subscriptions:', error);
        return new NextResponse('Error checking Stripe subscriptions', { status: 500 });
      }
    } else {
      console.log(`No Stripe customer ID found for user ${validatedUserId}`);
      return NextResponse.json({
        success: false,
        message: 'No Stripe customer ID found',
        subscription,
      });
    }
  } catch (error) {
    console.error('Unexpected error updating subscription status:', error);
    return new NextResponse('Server error', { status: 500 });
  }
} 