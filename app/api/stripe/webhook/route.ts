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
  const supabase = await createClient();
  const stripe = getStripeInstance();

  try {
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature') || '';

    // Validate webhook signature
    if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('Missing Stripe signature or webhook secret');
      return new NextResponse('Missing signature or secret', { status: 400 });
    }

    // Construct and verify the event
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Error verifying webhook signature:', err);
      return new NextResponse('Invalid signature', { status: 400 });
    }

    console.log(`Processing webhook event: ${event.type}`, {
      id: event.id,
      api_version: event.api_version,
      created: new Date(event.created * 1000).toISOString()
    });

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      console.log('Processing checkout session:', {
        id: session.id,
        customer: session.customer,
        subscription: session.subscription,
        payment_status: session.payment_status,
        customer_email: session.customer_details?.email
      });

      if (!session.subscription || !session.customer) {
        console.error('Missing subscription or customer ID:', session.id);
        return new NextResponse('Invalid session data', { status: 400 });
      }

      // First, try to find existing user by customer ID
      const { data: existingUser } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_customer_id', session.customer)
        .single();

      let userId = existingUser?.user_id;

      if (!userId) {
        // If no existing user, try to find by email
        const { data: userByEmail } = await supabase
          .from('users')
          .select('id')
          .eq('email', session.customer_details?.email)
          .single();

        if (!userByEmail?.id) {
          console.error('Could not find user for customer:', {
            customer: session.customer,
            email: session.customer_details?.email
          });
          return new NextResponse('User not found', { status: 400 });
        }

        userId = userByEmail.id;

        // Update customer metadata with user ID for future reference
        await stripe.customers.update(session.customer as string, {
          metadata: { userId }
        });
      }

      // Retrieve full subscription details
      const subscription = await stripe.subscriptions.retrieve(
        session.subscription as string,
        {
          expand: ['latest_invoice', 'latest_invoice.payment_intent']
        }
      );

      // Verify payment success
      const invoice = subscription.latest_invoice as Stripe.Invoice;
      if (invoice?.payment_intent && 
          typeof invoice.payment_intent !== 'string' && 
          invoice.payment_intent.status !== 'succeeded') {
        console.error('Payment verification failed:', subscription.id);
        return new NextResponse('Payment not verified', { status: 400 });
      }

      const priceId = subscription.items.data[0].price.id;
      const planType = Object.entries(PRICE_IDS)
        .find(([_, id]) => id === priceId)?.[0] as 'premium' | 'free' || 'free';

      const updateData = {
        user_id: userId,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: session.customer as string,
        stripe_price_id: priceId,
        status: subscription.status,
        plan_type: planType,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('subscriptions')
        .upsert(updateData)
        .eq('user_id', userId);

      if (updateError) {
        console.error('Error updating subscription:', updateError);
        return new NextResponse('Database update failed', { status: 500 });
      }

      console.log('Successfully processed subscription:', {
        user_id: userId,
        subscription_id: subscription.id,
        plan_type: planType,
        status: subscription.status
      });

      return new NextResponse(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Handle other webhook events here if needed
    console.log('Unhandled webhook event type:', event.type);
    return new NextResponse(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new NextResponse('Webhook error', { status: 500 });
  }
} 