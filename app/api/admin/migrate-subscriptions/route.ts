import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { getCookieOptions } from '@/utils/supabase/cookies-helper';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const cookieOptions = await getCookieOptions();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: cookieOptions,
      }
    );

    // Check if the user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized: Not authenticated' },
        { status: 401 }
      );
    }

    // Check if the user is an admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile || !profile.is_admin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin privileges required' },
        { status: 403 }
      );
    }

    // Get all users from the profiles table
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id');

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return NextResponse.json(
        { error: 'Failed to fetch profiles' },
        { status: 500 }
      );
    }

    // Get all users who already have a subscription
    const { data: existingSubscriptions, error: subscriptionsError } = await supabase
      .from('subscriptions')
      .select('user_id');

    if (subscriptionsError) {
      console.error('Error fetching existing subscriptions:', subscriptionsError);
      return NextResponse.json(
        { error: 'Failed to fetch existing subscriptions' },
        { status: 500 }
      );
    }

    // Create a set of user IDs who already have subscriptions
    const existingSubscriptionUserIds = new Set(
      existingSubscriptions.map((sub) => sub.user_id)
    );

    // Filter out users who already have subscriptions
    const usersWithoutSubscriptions = profiles.filter(
      (profile) => !existingSubscriptionUserIds.has(profile.id)
    );

    if (usersWithoutSubscriptions.length === 0) {
      return NextResponse.json({
        message: 'All users already have subscription records',
        created: 0,
      });
    }

    // Create subscription records for users who don't have one
    const now = new Date().toISOString();
    const newSubscriptions = usersWithoutSubscriptions.map((profile) => ({
      id: uuidv4(),
      user_id: profile.id,
      status: 'active',
      plan_type: 'free',
      created_at: now,
      updated_at: now,
    }));

    // Insert the new subscription records
    const { error: insertError } = await supabase
      .from('subscriptions')
      .insert(newSubscriptions);

    if (insertError) {
      console.error('Error creating subscription records:', insertError);
      return NextResponse.json(
        { error: 'Failed to create subscription records' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `Successfully created ${newSubscriptions.length} subscription records`,
      created: newSubscriptions.length,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 