import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// Define protected and public routes
const PROTECTED_ROUTES = [
  '/dashboard',
  '/dashboard/learn',
  '/dashboard/history',
  '/dashboard/subscription',
  '/dashboard/suggest',
  '/auth/reset-password',
];

const AUTH_ROUTES = [
  '/auth/sign-in',
  '/auth/sign-up',
  '/auth/forgot-password',
];

const CALLBACK_ROUTES = [
  '/auth/callback',
];

export async function middleware(request: NextRequest) {
  try {
    // Create a response object that we can modify
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    // Create a Supabase client with enhanced cookie handling
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            response.cookies.set({
              name,
              value,
              ...options,
            });
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set({
              name,
              value: '',
              ...options,
            });
          },
        },
      }
    );

    // Refresh session if expired - required for Server Components
    await supabase.auth.getSession();

    // Skip middleware for callback routes
    if (CALLBACK_ROUTES.some(route => request.nextUrl.pathname === route)) {
      return response;
    }

    try {
      // Get the user session with error handling
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error in middleware:', sessionError);
        // Clear problematic session cookies on error
        response.cookies.set({
          name: 'sb-access-token',
          value: '',
          maxAge: 0,
          path: '/',
        });
        response.cookies.set({
          name: 'sb-refresh-token',
          value: '',
          maxAge: 0,
          path: '/',
        });
      }

      const isProtectedRoute = PROTECTED_ROUTES.some(route => 
        request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(`${route}/`)
      );

      const isAuthRoute = AUTH_ROUTES.some(route => 
        request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(`${route}/`)
      );

      // Handle protected routes
      if (isProtectedRoute && !session) {
        // Store the original URL to redirect back after login
        const redirectUrl = new URL('/auth/sign-in', request.url);
        redirectUrl.searchParams.set('redirectedFrom', request.nextUrl.pathname);
        return NextResponse.redirect(redirectUrl);
      }

      // Handle auth routes (prevent authenticated users from accessing login/signup)
      if (isAuthRoute && session) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }

      // Handle root path redirect for authenticated users
      if (request.nextUrl.pathname === '/' && session) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }

      return response;

    } catch (error) {
      console.error('Middleware auth check error:', error);
      
      // On critical errors, redirect to sign-in for protected routes
      if (PROTECTED_ROUTES.some(route => request.nextUrl.pathname.startsWith(route))) {
        const redirectUrl = new URL('/auth/sign-in', request.url);
        redirectUrl.searchParams.set('error', 'Session verification failed');
        return NextResponse.redirect(redirectUrl);
      }
      
      return response;
    }

  } catch (error) {
    console.error('Critical middleware error:', error);
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }
}

// Only run middleware on specific paths
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/|api/).*)',
  ],
}; 