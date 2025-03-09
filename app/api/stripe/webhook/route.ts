import { NextResponse } from 'next/server';
import { getStripeInstance } from '@/utils/stripe';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Import the PRICE_IDs from the stripe utils
const PRICE_IDS = {
  premium: process.env.STRIPE_PREMIUM_PLAN_PRICE_ID || '',
  premium_annual: process.env.STRIPE_PREMIUM_ANNUAL_PLAN_PRICE_ID || '',
};

// Set the runtime to nodejs to avoid Edge Runtime issues with cookies
export const runtime = 'nodejs';

// Create a direct Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    // Get the raw request body for Stripe signature verification
    const body = await request.text();
    const signature = (await headers()).get('stripe-signature') as string;
    
    if (!signature) {
      console.error('No Stripe signature found in request');
      return new NextResponse('No Stripe signature', { status: 400 });
    }
    
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('STRIPE_WEBHOOK_SECRET is not set');
      return new NextResponse('Webhook secret not configured', { status: 500 });
    }

    // Initialize Stripe
    const stripe = getStripeInstance();

    // Verify the webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err: any) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
    }

    console.log(`Processing webhook event: ${event.type}`, {
      id: event.id,
      type: event.type,
      object: event.object,
      apiVersion: event.api_version,
      created: new Date(event.created * 1000).toISOString(),
    });

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Get the customer ID and subscription ID
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        
        if (!customerId) {
          console.error('No customer ID found in checkout session');
          return new NextResponse('Invalid checkout session data', { status: 400 });
        }
        
        if (!subscriptionId) {
          console.error('No subscription ID found in checkout session');
          return new NextResponse('Invalid checkout session data', { status: 400 });
        }
        
        console.log(`Checkout completed for customer ${customerId}, subscription ${subscriptionId}`);
        
        // Get the subscription details
        let subscription;
        try {
          subscription = await stripe.subscriptions.retrieve(subscriptionId);
          console.log('Retrieved subscription details:', {
            id: subscription.id,
            status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            items: subscription.items.data.map(item => ({
              id: item.id,
              price: item.price.id,
              product: item.price.product
            }))
          });
        } catch (error) {
          console.error(`Error retrieving subscription ${subscriptionId}:`, error);
          return new NextResponse('Error retrieving subscription', { status: 500 });
        }
        
        const priceId = subscription.items.data[0].price.id;
        
        // Determine plan type based on price ID
        let planType: 'free' | 'premium' = 'free';
        
        // Check if the price ID matches any of our premium plans
        if (priceId === PRICE_IDS.premium || priceId === PRICE_IDS.premium_annual) {
          planType = 'premium';
        }
        
        console.log(`Checkout completed for customer ${customerId}, subscription ${subscriptionId}, plan ${planType}, priceId ${priceId}`);
        console.log(`Expected premium price IDs: premium=${PRICE_IDS.premium}, premium_annual=${PRICE_IDS.premium_annual}`);
        
        // Update the subscription in the database
        const { data: existingSubscription, error: fetchError } = await supabase
          .from('subscriptions')
          .select('id, user_id')
          .eq('stripe_customer_id', customerId)
          .single();
        
        if (fetchError) {
          console.error('Error fetching subscription:', fetchError);
          
          // Try to find by customer ID directly from Stripe
          try {
            const customer = await stripe.customers.retrieve(customerId);
            if (customer && !customer.deleted && customer.metadata && customer.metadata.userId) {
              const userId = customer.metadata.userId;
              console.log(`Found user ID ${userId} from customer metadata`);
              
              // Check if user has a subscription record
              const { data: userSubscription, error: userSubError } = await supabase
                .from('subscriptions')
                .select('id')
                .eq('user_id', userId)
                .single();
                
              if (userSubError && userSubError.code !== 'PGRST116') {
                console.error('Error checking for user subscription:', userSubError);
              }
              
              if (userSubscription) {
                // Update existing subscription
                const updateData = {
                  stripe_customer_id: customerId,
                  stripe_subscription_id: subscriptionId,
                  stripe_price_id: priceId,
                  status: subscription.status,
                  plan_type: planType,
                  current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                  current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                  cancel_at_period_end: subscription.cancel_at_period_end,
                  updated_at: new Date().toISOString(),
                };
                
                console.log(`Updating subscription for user ${userId} with data:`, updateData);
                
                const { error: updateError } = await supabase
                  .from('subscriptions')
                  .update(updateData)
                  .eq('id', userSubscription.id);
                  
                if (updateError) {
                  console.error('Error updating user subscription:', updateError);
                  return new NextResponse('Error updating subscription', { status: 500 });
                } else {
                  console.log(`Successfully updated subscription for user ${userId} to plan ${planType}`);
                  
                  // Verify the update was successful
                  const { data: verifySubscription } = await supabase
                    .from('subscriptions')
                    .select('*')
                    .eq('id', userSubscription.id)
                    .single();
                    
                  console.log('Updated subscription data:', JSON.stringify(verifySubscription));
                  return new NextResponse('Webhook received and processed', { status: 200 });
                }
              } else {
                // Create new subscription
                const insertData = {
                  user_id: userId,
                  stripe_customer_id: customerId,
                  stripe_subscription_id: subscriptionId,
                  stripe_price_id: priceId,
                  status: subscription.status,
                  plan_type: planType,
                  current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                  current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                  cancel_at_period_end: subscription.cancel_at_period_end,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };
                
                console.log(`Creating subscription for user ${userId} with data:`, insertData);
                
                const { error: insertError } = await supabase
                  .from('subscriptions')
                  .insert(insertData);
                  
                if (insertError) {
                  console.error('Error creating subscription record:', insertError);
                  return new NextResponse('Error creating subscription', { status: 500 });
                } else {
                  console.log(`Successfully created subscription for user ${userId} with plan ${planType}`);
                  return new NextResponse('Webhook received and processed', { status: 200 });
                }
              }
            }
          } catch (error) {
            console.error('Error retrieving customer or creating subscription:', error);
            return new NextResponse('Error processing webhook', { status: 500 });
          }
        }
        
        if (existingSubscription) {
          const updateData = {
            stripe_subscription_id: subscriptionId,
            stripe_price_id: priceId,
            status: subscription.status,
            plan_type: planType,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          };
          
          console.log(`Updating subscription for user ${existingSubscription.user_id} with data:`, updateData);
          
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update(updateData)
            .eq('id', existingSubscription.id);
            
          if (updateError) {
            console.error('Error updating subscription:', updateError);
            return new NextResponse('Error updating subscription', { status: 500 });
          }
          
          console.log(`Successfully updated subscription for user ${existingSubscription.user_id} to plan ${planType}`);
          
          // Verify the update was successful
          const { data: verifySubscription } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('id', existingSubscription.id)
            .single();
            
          console.log('Updated subscription data:', JSON.stringify(verifySubscription));
        } else {
          console.error('No subscription found for customer:', customerId);
          return new NextResponse('No subscription found', { status: 404 });
        }
        
        break;
      }
      
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const priceId = subscription.items.data[0].price.id;
        
        // Determine plan type based on price ID
        let planType: 'free' | 'premium' = 'free';
        
        // Check if the price ID matches any of our premium plans
        if (priceId === PRICE_IDS.premium || priceId === PRICE_IDS.premium_annual) {
          planType = 'premium';
        }
        
        console.log(`Subscription updated for customer ${customerId}, subscription ${subscription.id}, plan ${planType}, priceId ${priceId}`);
        console.log(`Expected premium price IDs: premium=${PRICE_IDS.premium}, premium_annual=${PRICE_IDS.premium_annual}`);
        
        // Update the subscription in the database
        const updateData = {
          stripe_price_id: priceId,
          status: subscription.status,
          plan_type: planType,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        };
        
        console.log(`Updating subscription ${subscription.id} with data:`, updateData);
        
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update(updateData)
          .eq('stripe_subscription_id', subscription.id);
          
        if (updateError) {
          console.error('Error updating subscription:', updateError);
          
          // Try to find by customer ID instead
          const { error: customerUpdateError } = await supabase
            .from('subscriptions')
            .update(updateData)
            .eq('stripe_customer_id', customerId);
            
          if (customerUpdateError) {
            console.error('Error updating subscription by customer ID:', customerUpdateError);
            return new NextResponse('Error updating subscription', { status: 500 });
          }
        }
        
        // Get the user ID for logging
        const { data: subscriptionData } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', subscription.id)
          .single();
          
        if (subscriptionData) {
          console.log(`Successfully updated subscription for user ${subscriptionData.user_id} to plan ${planType}`);
          
          // Verify the update was successful
          const { data: verifySubscription } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('stripe_subscription_id', subscription.id)
            .single();
            
          console.log('Updated subscription data:', JSON.stringify(verifySubscription));
        } else {
          // Try to find by customer ID
          const { data: customerSubscriptionData } = await supabase
            .from('subscriptions')
            .select('user_id')
            .eq('stripe_customer_id', customerId)
            .single();
            
          if (customerSubscriptionData) {
            console.log(`Successfully updated subscription for user ${customerSubscriptionData.user_id} to plan ${planType} (found by customer ID)`);
          } else {
            console.error('Could not find subscription record for update confirmation');
          }
        }
        
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        
        console.log(`Subscription deleted: ${subscription.id}`);
        
        // Get the user ID before updating
        const { data: subscriptionData } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', subscription.id)
          .single();
        
        // Update the subscription in the database to free plan
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            stripe_subscription_id: null,
            stripe_price_id: null,
            status: 'active',
            plan_type: 'free',
            current_period_start: null,
            current_period_end: null,
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id);
          
        if (updateError) {
          console.error('Error updating subscription to free plan:', updateError);
          
          // Try to update by customer ID instead
          const customerId = subscription.customer as string;
          const { error: customerUpdateError } = await supabase
            .from('subscriptions')
            .update({
              stripe_subscription_id: null,
              stripe_price_id: null,
              status: 'active',
              plan_type: 'free',
              current_period_start: null,
              current_period_end: null,
              cancel_at_period_end: false,
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_customer_id', customerId);
            
          if (customerUpdateError) {
            console.error('Error updating subscription to free plan by customer ID:', customerUpdateError);
            return new NextResponse('Error updating subscription to free plan', { status: 500 });
          }
        }
        
        if (subscriptionData) {
          console.log(`Successfully downgraded subscription to free plan for user ${subscriptionData.user_id}`);
          
          // Verify the update was successful
          const { data: verifySubscription } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', subscriptionData.user_id)
            .single();
            
          console.log('Updated subscription data:', JSON.stringify(verifySubscription));
        } else {
          // Try to find by customer ID
          const customerId = subscription.customer as string;
          const { data: customerSubscriptionData } = await supabase
            .from('subscriptions')
            .select('user_id')
            .eq('stripe_customer_id', customerId)
            .single();
            
          if (customerSubscriptionData) {
            console.log(`Successfully downgraded subscription to free plan for user ${customerSubscriptionData.user_id} (found by customer ID)`);
          } else {
            console.error('Could not find subscription record for deletion confirmation');
          }
        }
        
        break;
      }
    }

    return new NextResponse('Webhook received', { status: 200 });
  } catch (error) {
    console.error('Error handling webhook:', error);
    return new NextResponse('Error handling webhook', { status: 500 });
  }
} 