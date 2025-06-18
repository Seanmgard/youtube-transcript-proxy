import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { userId, planType = 'premium', durationInDays = 30 } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const supabase = await createClient();
    
    // Verify the requesting user is an admin (you can add this check based on your auth system)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if requesting user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Calculate period dates
    const now = new Date();
    const periodEnd = new Date(now.getTime() + (durationInDays * 24 * 60 * 60 * 1000));

    // Update the user's subscription
    const { data: updatedSubscription, error: updateError } = await supabase
      .from('subscriptions')
      .update({
        plan_type: planType,
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
        updated_at: now.toISOString(),
        // Clear Stripe fields since this is a manual upgrade
        stripe_customer_id: null,
        stripe_subscription_id: null,
        stripe_price_id: null
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating subscription:', updateError);
      return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `User upgraded to ${planType} plan for ${durationInDays} days`,
      subscription: updatedSubscription
    });

  } catch (error) {
    console.error('Error in manual upgrade:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 