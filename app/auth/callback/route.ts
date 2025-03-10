import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/dashboard';
  const redirect_to = searchParams.get('redirect_to');

  if (!code) {
    console.error('No code provided in callback');
    return NextResponse.redirect(`${origin}/auth/sign-in?error=No+authorization+code+provided`);
  }

  try {
    const supabase = await createServerSupabaseClient();
    
    // Exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error('Error exchanging code for session:', error.message);
      return NextResponse.redirect(`${origin}/auth/sign-in?error=${encodeURIComponent(error.message)}`);
    }

    // Get the user session to confirm it worked
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.error('No session after code exchange');
      return NextResponse.redirect(`${origin}/auth/sign-in?error=Authentication+failed`);
    }

    // Determine where to redirect the user
    let redirectUrl = redirect_to || next;
    
    // Ensure the redirect URL starts with a slash
    if (!redirectUrl.startsWith('/')) {
      redirectUrl = '/' + redirectUrl;
    }
    
    // Redirect to the dashboard or specified page
    return NextResponse.redirect(`${origin}${redirectUrl}`);
  } catch (error: any) {
    console.error('Unexpected error in auth callback:', error);
    return NextResponse.redirect(`${origin}/auth/sign-in?error=${encodeURIComponent('An unexpected error occurred')}`);
  }
}
