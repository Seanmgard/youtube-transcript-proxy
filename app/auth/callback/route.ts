import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/dashboard';
  const redirect_to = searchParams.get('redirect_to');
  const error = searchParams.get('error');
  const error_description = searchParams.get('error_description');

  // Handle error cases
  if (error) {
    console.error('Auth error:', error, error_description);
    return NextResponse.redirect(`${origin}/auth/sign-in?error=${encodeURIComponent(error_description || error)}`);
  }

  if (!code) {
    console.error('No code provided in callback');
    return NextResponse.redirect(`${origin}/auth/sign-in?error=No+authorization+code+provided`);
  }

  try {
    const cookieStore = cookies();
    const supabase = createServerSupabaseClient();
    
    // Exchange the code for a session
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (exchangeError) {
      console.error('Error exchanging code for session:', exchangeError.message);
      return NextResponse.redirect(`${origin}/auth/sign-in?error=${encodeURIComponent(exchangeError.message)}`);
    }

    // Get the user session to confirm it worked
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Error getting session after code exchange:', sessionError.message);
      return NextResponse.redirect(`${origin}/auth/sign-in?error=${encodeURIComponent(sessionError.message)}`);
    }
    
    if (!session) {
      console.error('No session after code exchange');
      return NextResponse.redirect(`${origin}/auth/sign-in?error=Authentication+failed`);
    }

    // Determine where to redirect the user
    let redirectUrl = redirect_to || next;
    
    // Handle password reset redirects
    if (redirect_to && redirect_to.includes('reset-password')) {
      redirectUrl = '/auth/reset-password';
    }
    
    // Ensure the redirect URL starts with a slash
    if (!redirectUrl.startsWith('/')) {
      redirectUrl = '/' + redirectUrl;
    }
    
    // Add a timestamp to bust cache and prevent stale redirects
    const timestamp = Date.now();
    const redirectUrlWithTimestamp = `${origin}${redirectUrl}${redirectUrl.includes('?') ? '&' : '?'}t=${timestamp}`;
    
    // Create a response with the redirect
    const response = NextResponse.redirect(redirectUrlWithTimestamp);
    
    // Manually set auth cookies in the response to ensure they're properly set
    if (session) {
      const maxAge = 60 * 60 * 8; // 8 hours
      response.cookies.set('sb-auth-token', session.access_token, {
        path: '/',
        maxAge,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
      
      // Set refresh token if available
      if (session.refresh_token) {
        response.cookies.set('sb-refresh-token', session.refresh_token, {
          path: '/',
          maxAge,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        });
      }
    }
    
    // Redirect to the dashboard or specified page
    return response;
  } catch (error: any) {
    console.error('Unexpected error in auth callback:', error);
    return NextResponse.redirect(`${origin}/auth/sign-in?error=${encodeURIComponent('An unexpected error occurred')}`);
  }
}
