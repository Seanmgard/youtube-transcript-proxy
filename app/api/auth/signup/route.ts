import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const email = formData.get('email')?.toString();
    const password = formData.get('password')?.toString();
    const firstName = formData.get('firstName')?.toString();
    const lastName = formData.get('lastName')?.toString();

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Create a server-side Supabase client
    const supabase = await createServerSupabaseClient();

    // Check if the email already exists
    const { data: existingUsers, error: lookupError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .limit(1);
      
    if (lookupError) {
      console.error('Error checking existing user:', lookupError);
    } else if (existingUsers && existingUsers.length > 0) {
      return NextResponse.json(
        { error: 'This email is already registered. Please sign in instead.' },
        { status: 400 }
      );
    }
    
    // Configure sign-up with explicit email verification settings
    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Provide a redirect URL for email verification
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
        data: {
          first_name: firstName,
          last_name: lastName,
        }
      },
    });

    if (error) {
      console.error('Sign up error:', error.code, error.message);
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Too many sign-up attempts. Please try again later or contact support.' },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // Create or update profile
    if (authData?.user) {
      try {
        // Use a SQL query to insert the profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            email: email, // Store email in profiles table for easier lookup
            full_name: `${firstName} ${lastName}`,
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            is_admin: false
          });

        if (profileError) {
          console.error('Profile creation error:', profileError);
        }
      } catch (profileError) {
        console.error('Profile creation error:', profileError);
        // Continue anyway - the profile might be created by a trigger
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'Account created successfully',
      emailConfirmationNeeded: authData?.user && !authData.session
    });
  } catch (error: any) {
    console.error('Unexpected error during sign up:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
} 