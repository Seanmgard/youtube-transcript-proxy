import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { getCookieOptions } from '@/utils/supabase/cookies-helper'

export async function GET(request: Request) {
  try {
    // The `/auth/callback` route is required for the server-side auth flow implemented
    // by the SSR package. It exchanges an auth code for the user's session.
    // https://supabase.com/docs/guides/auth/server-side/nextjs
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const redirectTo = searchParams.get('redirectTo') || '/dashboard'
    
    console.log('Auth callback received:', { code: !!code, redirectTo });

    if (code) {
      const cookieOptions = await getCookieOptions()
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: cookieOptions,
        }
      )

      try {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)
        
        if (error) {
          console.error('Error exchanging code for session:', error);
          throw error;
        }
        
        if (data.session && data.user) {
          console.log('Session established for user:', data.user.id);
          
          // Check if this is an OAuth user and create/update profile if needed
          if (data.user.app_metadata?.provider) {
            try {
              // Check if profile exists
              const { data: existingProfile, error: profileError } = await supabase
                .from('profiles')
                .select('id, first_name, last_name')
                .eq('id', data.user.id)
                .single();
                
              if (profileError && profileError.code === 'PGRST116') {
                // Profile doesn't exist, create it
                const { error: insertError } = await supabase
                  .from('profiles')
                  .insert([
                    { 
                      id: data.user.id,
                      first_name: data.user.user_metadata?.first_name || data.user.user_metadata?.name?.split(' ')[0] || '',
                      last_name: data.user.user_metadata?.last_name || data.user.user_metadata?.name?.split(' ').slice(1).join(' ') || '',
                      email: data.user.email,
                      avatar_url: data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture,
                    },
                  ]);
                  
                if (insertError) {
                  console.error('Error creating OAuth profile:', insertError);
                  // Continue anyway - don't block the sign-in
                } else {
                  console.log('Created profile for OAuth user:', data.user.id);
                }
              } else if (!profileError) {
                // Profile exists, optionally update it with latest OAuth data
                const { error: updateError } = await supabase
                  .from('profiles')
                  .update({
                    avatar_url: data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture,
                    // Only update name if not already set
                    first_name: existingProfile.first_name || data.user.user_metadata?.first_name || data.user.user_metadata?.name?.split(' ')[0] || '',
                    last_name: existingProfile.last_name || data.user.user_metadata?.last_name || data.user.user_metadata?.name?.split(' ').slice(1).join(' ') || '',
                  })
                  .eq('id', data.user.id);
                  
                if (updateError) {
                  console.error('Error updating OAuth profile:', updateError);
                  // Continue anyway
                }
              }
            } catch (profileErr) {
              console.error('Error handling OAuth profile:', profileErr);
              // Continue anyway - don't block the sign-in
            }
          }
          
          // Successful authentication - redirect to the intended destination
          const redirectUrl = new URL(redirectTo, request.url);
          console.log('Redirecting to:', redirectUrl.toString());
          return NextResponse.redirect(redirectUrl);
        }
      } catch (error) {
        console.error('Error in auth exchange:', error);
        // Return to sign-in with error
        const errorUrl = new URL('/auth/sign-in', request.url);
        errorUrl.searchParams.set('error', encodeURIComponent('Authentication failed. Please try again.'));
        return NextResponse.redirect(errorUrl);
      }
    }

    // No code provided or other error - return to sign-in
    console.log('No auth code provided, redirecting to sign-in');
    const signInUrl = new URL('/auth/sign-in', request.url);
    signInUrl.searchParams.set('error', encodeURIComponent('Authentication code missing. Please try again.'));
    return NextResponse.redirect(signInUrl);
    
  } catch (error) {
    console.error('Unexpected error in auth callback:', error);
    const errorUrl = new URL('/auth/sign-in', request.url);
    errorUrl.searchParams.set('error', encodeURIComponent('An unexpected error occurred. Please try again.'));
    return NextResponse.redirect(errorUrl);
  }
}
