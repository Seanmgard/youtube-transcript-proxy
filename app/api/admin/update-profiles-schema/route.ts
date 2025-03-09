import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { getCookieOptions } from '@/utils/supabase/cookies-helper';

export async function GET() {
  try {
    // Create a Supabase client
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

    // First, check if the is_admin column already exists
    const { data: columnInfo, error: columnCheckError } = await supabase
      .rpc('check_column_exists', {
        table_name: 'profiles',
        column_name: 'is_admin'
      });

    if (columnCheckError) {
      console.error('Error checking column existence:', columnCheckError);
      return NextResponse.json(
        { error: 'Failed to check if column exists' },
        { status: 500 }
      );
    }

    // If the column already exists, no need to add it
    if (columnInfo && columnInfo.exists) {
      return NextResponse.json({
        message: 'is_admin column already exists in profiles table',
        updated: false
      });
    }

    // Add the is_admin column to the profiles table
    const { error: alterTableError } = await supabase
      .rpc('add_column_to_profiles', {
        column_name: 'is_admin',
        column_type: 'boolean',
        default_value: 'false'
      });

    if (alterTableError) {
      console.error('Error adding is_admin column:', alterTableError);
      return NextResponse.json(
        { error: 'Failed to add is_admin column to profiles table' },
        { status: 500 }
      );
    }

    // Set the current user as an admin
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ is_admin: true })
      .eq('id', session.user.id);

    if (updateError) {
      console.error('Error setting user as admin:', updateError);
      return NextResponse.json(
        { error: 'Failed to set user as admin' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Successfully added is_admin column to profiles table and set current user as admin',
      updated: true
    });
  } catch (error) {
    console.error('Schema update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 