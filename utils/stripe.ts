import Stripe from 'stripe';

// Initialize Stripe with the secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as Stripe.LatestApiVersion, // Use the latest API version
});

// Price IDs for different subscription plans
const PRICE_IDS = {
  basic: process.env.STRIPE_BASIC_PLAN_PRICE_ID || '',
  premium: process.env.STRIPE_PREMIUM_PLAN_PRICE_ID || '',
  premium_annual: process.env.STRIPE_PREMIUM_ANNUAL_PLAN_PRICE_ID || '',
};

// Create a checkout session for subscription
export async function createCheckoutSession({
  customerId,
  priceId,
  returnUrl,
  couponId,
}: {
  customerId?: string;
  priceId: string;
  returnUrl: string;
  couponId?: string;
}) {
  try {
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${returnUrl}?success=true`,
      cancel_url: `${returnUrl}?canceled=true`,
      allow_promotion_codes: true, // Allow users to enter promotion codes
    };

    // If we have a customer ID, use it
    if (customerId) {
      params.customer = customerId;
    } else {
      params.customer_creation = 'always';
    }

    // If a specific coupon ID is provided, apply it
    if (couponId) {
      params.discounts = [
        {
          coupon: couponId,
        },
      ];
    }

    const session = await stripe.checkout.sessions.create(params);
    return session;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
}

// Create a customer portal session
export async function createCustomerPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl: string;
}) {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return session;
  } catch (error) {
    console.error('Error creating customer portal session:', error);
    throw error;
  }
}

// Get a price ID based on the plan type
export function getPriceId(planType: 'premium' | 'premium_annual') {
  return PRICE_IDS[planType];
}

// Get a subscription from Stripe
export async function getSubscription(subscriptionId: string) {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return subscription;
  } catch (error) {
    console.error('Error retrieving subscription:', error);
    throw error;
  }
}

// Get a customer from Stripe
export async function getCustomer(customerId: string) {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    return customer;
  } catch (error) {
    console.error('Error retrieving customer:', error);
    throw error;
  }
}

// Construct Stripe instance for webhook handling
export function getStripeInstance() {
  return stripe;
} 