import { NextResponse } from 'next/server';
import { getStripeInstance } from '@/utils/stripe';
import { headers } from 'next/headers';
import Stripe from 'stripe';
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
    const body = await request.text()
    const headerData = await headers()
    const signature = headerData.get('stripe-signature') as string
    const supabase = await createClient()

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
        
        // Get the subscription details with expanded price data
        let subscription;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            subscription = await stripe.subscriptions.retrieve(subscriptionId, {
              expand: [
                'items.data.price',
                'latest_invoice',
                'latest_invoice.payment_intent',
                'discount',
                'customer'
              ]
            });
            
            // Log complete subscription details for debugging
            console.log('Full subscription details:', JSON.stringify({
              id: subscription.id,
              status: subscription.status,
              customer: typeof subscription.customer === 'string' ? {
                id: subscription.customer,
                metadata: null
              } : {
                id: (subscription.customer as Stripe.Customer).id,
                metadata: (subscription.customer as Stripe.Customer).metadata
              },
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              items: subscription.items.data.map(item => ({
                id: item.id,
                price: item.price.id,
                product: item.price.product
              })),
              discount: subscription.discount ? {
                coupon: subscription.discount.coupon.id,
                amount_off: subscription.discount.coupon.amount_off,
                percent_off: subscription.discount.coupon.percent_off
              } : null,
              latest_invoice: subscription.latest_invoice && typeof subscription.latest_invoice !== 'string' ? {
                status: (subscription.latest_invoice as Stripe.Invoice).status,
                payment_status: (subscription.latest_invoice as Stripe.Invoice).payment_intent && 
                  typeof (subscription.latest_invoice as Stripe.Invoice).payment_intent !== 'string' ? 
                  ((subscription.latest_invoice as Stripe.Invoice).payment_intent as Stripe.PaymentIntent).status : 
                  null,
                amount_paid: (subscription.latest_invoice as Stripe.Invoice).amount_paid
              } : null
            }, null, 2));
            
            break; // Exit retry loop if successful
          } catch (error) {
            retryCount++;
            console.error(`Attempt ${retryCount} failed to retrieve subscription:`, error);
            if (retryCount === maxRetries) throw error;
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
          }
        }

        // Verify payment is successful by checking the invoice status
        if (!subscription) {
          throw new Error('Failed to retrieve subscription after retries');
        }

        if (typeof subscription.latest_invoice === 'string') {
          throw new Error('Unexpected string value for latest_invoice');
        }
        const invoice = subscription.latest_invoice as Stripe.Invoice;
        if (invoice.status !== 'paid') {
          console.error(`Payment not successful. Invoice status: ${invoice.status}`);
          return new NextResponse('Payment not completed', { status: 400 });
        }

        const priceId = subscription.items.data[0].price.id;
        
        // Determine plan type based on price ID
        let planType: 'free' | 'premium' = 'free';
        
        // Check if the price ID matches any of our premium plans
        if (priceId === PRICE_IDS.premium || priceId === PRICE_IDS.premium_annual) {
          planType = 'premium';
        }
        
        console.log(`Price ID check: Expected premium IDs [${PRICE_IDS.premium}, ${PRICE_IDS.premium_annual}], Got: ${priceId}, Result: ${planType}`);
        
        // Get the user ID with retries
        let userId;
        retryCount = 0;
        
        while (retryCount < maxRetries) {
          try {
            // First try to get userId from customer metadata
            if (subscription.customer && 
                typeof subscription.customer !== 'string' && 
                'metadata' in subscription.customer && 
                subscription.customer.metadata?.userId) {
              userId = subscription.customer.metadata.userId;
              console.log(`Found userId ${userId} in customer metadata`);
              break;
            }
            
            // If not in metadata, try to find in subscriptions table
            const { data: existingSubscription, error } = await supabase
              .from('subscriptions')
              .select('user_id')
              .eq('stripe_customer_id', customerId)
              .single();
            
            if (error) {
              console.error(`Attempt ${retryCount + 1} failed to find user_id:`, error);
              throw error;
            }
            
            if (existingSubscription) {
              userId = existingSubscription.user_id;
              console.log(`Found userId ${userId} in subscriptions table`);
              break;
            }
            
            throw new Error('No user_id found in metadata or subscriptions table');
          } catch (error) {
            retryCount++;
            if (retryCount === maxRetries) throw error;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
          }
        }

        if (!userId) {
          console.error('Could not find user_id after all attempts');
          return new NextResponse('User ID not found', { status: 400 });
        }

        // Update subscription in database with retries
        const updateData = {
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: customerId,
          stripe_price_id: priceId,
          status: subscription.status,
          plan_type: planType,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        };
        
        console.log(`Attempting to update subscription for user ${userId}:`, updateData);
        
        retryCount = 0;
        while (retryCount < maxRetries) {
          try {
            const { error: updateError } = await supabase
              .from('subscriptions')
              .update(updateData)
              .eq('user_id', userId);
              
            if (updateError) throw updateError;
            
            // Verify the update was successful
            const { data: verifySubscription, error: verifyError } = await supabase
              .from('subscriptions')
              .select('*')
              .eq('user_id', userId)
              .single();
              
            if (verifyError) throw verifyError;
            
            console.log('Subscription update verified:', verifySubscription);
            break;
          } catch (error) {
            retryCount++;
            console.error(`Attempt ${retryCount} failed to update subscription:`, error);
            if (retryCount === maxRetries) throw error;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
          }
        }

        console.log(`Successfully processed checkout.session.completed for user ${userId}`);
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