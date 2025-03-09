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
    const next = searchParams.get('next') ?? '/dashboard'

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
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          return NextResponse.redirect(new URL(next, request.url))
        }
      } catch (error) {
        console.error('Error exchanging code for session:', error)
      }
    }

    // Return the user to an error page with some instructions
    return NextResponse.redirect(new URL('/auth/auth-code-error', request.url))
  } catch (error) {
    console.error('Error in auth callback:', error)
    return NextResponse.redirect(new URL('/auth/auth-code-error', request.url))
  }
}
