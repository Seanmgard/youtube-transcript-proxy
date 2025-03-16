import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@supabase/supabase-js';
import { createServerClient as createSSRClient } from '@supabase/ssr';
import { getStripeInstance } from '@/utils/stripe';
import { PRICE_IDS } from '@/lib/stripe/price-ids';
import { cookies } from 'next/headers';

// Set the runtime to nodejs to avoid Edge Runtime issues with cookies
export const runtime = 'nodejs';

// Check required environment variables
const requiredEnvVars = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
} as const;

for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    throw new Error(`${key} is required`);
  }
}

export async function POST(request: Request) {
  try {
    // Initialize cookie store and create Supabase client for auth
    const cookieStore = await cookies();
    
    // Create a Supabase client with cookie handling
    const supabase = createSSRClient(
      requiredEnvVars.NEXT_PUBLIC_SUPABASE_URL,
      requiredEnvVars.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string) {
            try {
              cookieStore.set(name, value);
            } catch (e) {
              console.warn('Failed to set cookie:', e);
            }
          },
          remove(name: string) {
            try {
              cookieStore.delete(name);
            } catch (e) {
              console.warn('Failed to remove cookie:', e);
            }
          },
        },
      }
    );

    // Get the authenticated user from the session cookie
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication error:', {
        error: authError?.message || 'No user found',
        cookies: Array.from(cookieStore.getAll()).map((c) => c.name),
      });
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userId = user.id;
    console.log(`Updating subscription status for authenticated user ${userId}`);

    // Create admin client for database operations
    const supabaseAdmin = createServerClient(
      requiredEnvVars.NEXT_PUBLIC_SUPABASE_URL,
      requiredEnvVars.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const stripe = getStripeInstance();

    // Get current subscription from Supabase
    const { data: existingSub, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (subError && subError.code !== 'PGRST116') {
      console.error('Error fetching subscription:', subError);
      return NextResponse.json({ error: subError.message }, { status: 500 });
    }

    let customerId = existingSub?.stripe_customer_id;

    // If no existing subscription or no customer ID, try to find customer in Stripe
    if (!customerId) {
      console.log('No customer ID found, checking Stripe for customer');
      
      // Get user email from Supabase
      const { data: userData, error: userError } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .single();

      if (userError || !userData?.email) {
        console.error('Error fetching user email:', userError);
        return NextResponse.json({ error: 'Could not find user email' }, { status: 500 });
      }

      // Search for customer in Stripe by email
      const customers = await stripe.customers.list({
        email: userData.email,
        limit: 1
      });

      customerId = customers.data[0]?.id || null;
      
      if (customerId) {
        // First try to update any existing record
        const { error: updateError } = await supabaseAdmin
          .from('subscriptions')
          .update({
            stripe_customer_id: customerId,
            plan_type: 'free',
            status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (updateError) {
          // If update fails, try to insert a new record
          const { error: insertError } = await supabaseAdmin
            .from('subscriptions')
            .insert({
              user_id: userId,
              stripe_customer_id: customerId,
              plan_type: 'free',
              status: 'active',
              updated_at: new Date().toISOString()
            });

          if (insertError) {
            console.error('Error creating subscription record:', insertError);
            return NextResponse.json({ error: insertError.message }, { status: 500 });
          }
        }
      } else {
        console.log('No Stripe customer found, returning free subscription');
        return NextResponse.json({
          success: true,
          subscription: {
            user_id: userId,
            plan_type: 'free',
            status: 'active',
            updated_at: new Date().toISOString()
          }
        });
      }
    }

    try {
      // Get all subscriptions for this customer from Stripe
      const stripeSubscriptions = await stripe.subscriptions.list({
        customer: customerId,
        limit: 1,
        status: 'active',
        expand: ['data.latest_invoice', 'data.latest_invoice.payment_intent']
      });

      console.log(`Found ${stripeSubscriptions.data.length} active subscriptions for customer ${customerId}`);

      // If there's an active subscription, update the database
      if (stripeSubscriptions.data.length > 0) {
        const latestSubscription = stripeSubscriptions.data[0];
        const priceId = latestSubscription.items.data[0].price.id;

        // Determine plan type based on price ID
        let planType: 'free' | 'premium' = 'free';
        if (priceId === PRICE_IDS.premium || priceId === PRICE_IDS.premium_annual) {
          planType = 'premium';
        }

        console.log(`Updating subscription for user ${userId} to plan ${planType}`);

        const updateData = {
          user_id: userId,
          stripe_subscription_id: latestSubscription.id,
          stripe_customer_id: customerId,
          stripe_price_id: priceId,
          status: latestSubscription.status,
          plan_type: planType,
          current_period_start: new Date(latestSubscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(latestSubscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: latestSubscription.cancel_at_period_end,
          updated_at: new Date().toISOString()
        };

        // Update subscription using update + insert fallback instead of upsert
        const { error: updateError } = await supabaseAdmin
          .from('subscriptions')
          .update(updateData)
          .eq('user_id', userId);

        if (updateError) {
          // If update fails, try to insert
          const { error: insertError } = await supabaseAdmin
            .from('subscriptions')
            .insert(updateData);

          if (insertError) {
            console.error('Error creating subscription record:', insertError);
            return NextResponse.json({ error: insertError.message }, { status: 500 });
          }
        }

        return NextResponse.json({
          success: true,
          subscription: updateData
        });
      } else {
        // No active subscriptions found, ensure user is on free plan
        const updateData = {
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: null,
          stripe_price_id: null,
          status: 'active',
          plan_type: 'free',
          current_period_start: null,
          current_period_end: null,
          cancel_at_period_end: false,
          updated_at: new Date().toISOString()
        };

        // Update subscription using update + insert fallback instead of upsert
        const { error: updateError } = await supabaseAdmin
          .from('subscriptions')
          .update(updateData)
          .eq('user_id', userId);

        if (updateError) {
          // If update fails, try to insert
          const { error: insertError } = await supabaseAdmin
            .from('subscriptions')
            .insert(updateData);

          if (insertError) {
            console.error('Error creating subscription record:', insertError);
            return NextResponse.json({ error: insertError.message }, { status: 500 });
          }
        }

        return NextResponse.json({
          success: true,
          subscription: updateData
        });
      }
    } catch (error) {
      console.error('Error checking Stripe subscriptions:', error);
      return NextResponse.json({ error: 'Failed to check subscription status' }, { status: 500 });
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
} 