import { NextResponse } from 'next/server';
import { createCheckoutSession, getPriceId, getStripeInstance } from '@/utils/stripe';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';

// Set the runtime to nodejs to avoid Edge Runtime issues with cookies
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    // Initialize Supabase client inside the handler
    const supabase = await createClient();

    // Get the user ID from the authorization header
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;
    
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
        userId = user.id;
      } catch (error) {
        console.error('Error verifying token:', error);
        return new NextResponse('Unauthorized - Invalid token', { status: 401 });
      }
    } else {
      // Try to get the user ID from the request body
      try {
        const body = await request.json();
        userId = body.userId;
      } catch (error) {
        console.error('Error parsing request body:', error);
      }
      
      if (!userId) {
        return new NextResponse('Unauthorized - No user ID provided', { status: 401 });
      }
    }
    
    console.log(`Creating checkout session for user ${userId}`);
    
    // Parse the request body
    let body;
    try {
      // Reset the request body stream
      const clonedRequest = request.clone();
      body = await clonedRequest.json();
    } catch (error) {
      console.error('Error parsing request body:', error);
      return new NextResponse('Invalid request body', { status: 400 });
    }
    
    const { planType, couponId } = body;

    if (!planType || (planType !== 'premium' && planType !== 'premium_annual')) {
      return new NextResponse('Invalid plan type', { status: 400 });
    }

    // Get the price ID for the selected plan
    const priceId = getPriceId(planType);
    
    if (!priceId) {
      console.error(`No price ID found for plan type: ${planType}`);
      return new NextResponse('Invalid plan configuration', { status: 500 });
    }

    // Check if the user already has a Stripe customer ID
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();
      
    if (subscriptionError && subscriptionError.code !== 'PGRST116') {
      console.error('Error fetching subscription:', subscriptionError);
      return new NextResponse('Error fetching subscription', { status: 500 });
    }

    let customerId = subscription?.stripe_customer_id;

    // If the user doesn't have a Stripe customer ID, create one
    if (!customerId) {
      // Get the user's email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email, first_name, last_name')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        return new NextResponse('Error fetching user profile', { status: 500 });
      }

      if (!profile) {
        console.error('User profile not found for user ID:', userId);
        return new NextResponse('User profile not found', { status: 404 });
      }

      // Get the user's email from auth if not in profile
      let userEmail = profile.email;
      if (!userEmail) {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          console.error('Error fetching user email:', userError);
        } else {
          userEmail = user.email;
        }
      }

      // Create a Stripe customer
      try {
        const stripe = getStripeInstance();
        const customer = await stripe.customers.create({
          email: userEmail,
          name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || undefined,
          metadata: {
            userId,
          },
        });

        customerId = customer.id;
        console.log(`Created new Stripe customer: ${customerId} for user: ${userId}`);

        // Update the user's subscription record with the Stripe customer ID
        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (!existingSub) {
          // Only insert if no subscription exists
          const { error: insertError } = await supabase
            .from('subscriptions')
            .insert({
              user_id: userId,
              stripe_customer_id: customerId,
              status: 'incomplete',
              plan_type: planType,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
            
          if (insertError) {
            console.error('Error creating initial subscription record:', insertError);
            // Continue anyway as we have the customer ID
          } else {
            console.log(`Created initial subscription record for user ${userId}`);
          }
        } else {
          // Update existing subscription with new customer ID
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
              stripe_customer_id: customerId,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);
            
          if (updateError) {
            console.error('Error updating subscription with customer ID:', updateError);
            // Continue anyway as we have the customer ID
          } else {
            console.log(`Updated existing subscription record with Stripe customer ID: ${customerId}`);
          }
        }
      } catch (error) {
        console.error('Error creating Stripe customer:', error);
        return new NextResponse('Error creating Stripe customer', { status: 500 });
      }
    } else {
      // Make sure the customer has the userId in metadata
      try {
        const stripe = getStripeInstance();
        const customer = await stripe.customers.retrieve(customerId);
        
        if (customer && !customer.deleted) {
          // Check if userId is in metadata
          if (!customer.metadata || !customer.metadata.userId) {
            console.log(`Updating customer ${customerId} with userId ${userId} in metadata`);
            await stripe.customers.update(customerId, {
              metadata: {
                userId,
                ...customer.metadata
              }
            });
          }
        }
      } catch (error) {
        console.error('Error updating customer metadata:', error);
        // Continue anyway
      }
    }

    // Create a checkout session
    try {
      const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      const checkoutSession = await createCheckoutSession({
        customerId,
        priceId,
        returnUrl: `${origin}/dashboard/subscription`,
        couponId: couponId || undefined,
      });

      console.log(`Created checkout session: ${checkoutSession.id} for customer: ${customerId}, plan: ${planType}`);
      return NextResponse.json({ url: checkoutSession.url });
    } catch (error) {
      console.error('Error creating checkout session:', error);
      return new NextResponse('Error creating checkout session', { status: 500 });
    }
  } catch (error) {
    console.error('Unexpected error in checkout session creation:', error);
    return new NextResponse('Server error', { status: 500 });
  }
} 