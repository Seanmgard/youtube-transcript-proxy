import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { getCookieOptions } from '@/utils/supabase/cookies-helper';

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

    // Run the function to ensure all users have a subscription
    const { data, error } = await supabase
      .rpc('ensure_all_users_have_subscription');

    if (error) {
      console.error('Error ensuring subscriptions:', error);
      return NextResponse.json(
        { error: 'Failed to ensure subscriptions' },
        { status: 500 }
      );
    }

    // Count the number of subscriptions created
    const createdCount = data ? data.length : 0;

    return NextResponse.json({
      message: createdCount > 0
        ? `Successfully created ${createdCount} subscription records`
        : 'All users already have subscription records',
      created: createdCount,
      details: data
    });
  } catch (error) {
    console.error('Error ensuring subscriptions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 