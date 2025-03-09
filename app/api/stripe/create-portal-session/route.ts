import { NextResponse } from 'next/server';
import { createCustomerPortalSession } from '@/utils/stripe';
import { createClient } from '@supabase/supabase-js';

// Set the runtime to nodejs to avoid Edge Runtime issues with cookies
export const runtime = 'nodejs';

// Create a direct Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
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
    
    console.log(`Creating portal session for user ${userId}`);

    // Get the user's Stripe customer ID
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    if (subscriptionError) {
      console.error('Error fetching subscription:', subscriptionError);
      return new NextResponse('Error fetching subscription', { status: 500 });
    }

    if (!subscription?.stripe_customer_id) {
      console.error('No customer ID found for user:', userId);
      return new NextResponse('No subscription found', { status: 404 });
    }

    // Create a customer portal session
    try {
      const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      const portalSession = await createCustomerPortalSession({
        customerId: subscription.stripe_customer_id,
        returnUrl: `${origin}/dashboard/subscription`,
      });

      console.log(`Successfully created portal session for user ${userId}`);
      return NextResponse.json({ url: portalSession.url });
    } catch (error) {
      console.error('Error creating portal session:', error);
      return new NextResponse('Error creating portal session', { status: 500 });
    }
  } catch (error) {
    console.error('Unexpected error in portal session creation:', error);
    return new NextResponse('Server error', { status: 500 });
  }
} 