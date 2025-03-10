import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const email = formData.get('email')?.toString();
    const password = formData.get('password')?.toString();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Create a server-side Supabase client
    const supabase = await createServerSupabaseClient();

    // Attempt to sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Sign in error:', error.message);
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }

    if (!data.session) {
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    // Create a response with the session data
    const response = NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
      }
    });

    // Let Supabase handle the cookie setting through its built-in mechanisms
    // This avoids potential issues with cookie formatting

    return response;
  } catch (error: any) {
    console.error('Unexpected error during sign in:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
} 