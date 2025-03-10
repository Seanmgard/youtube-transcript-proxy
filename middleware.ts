import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  // Create a response object that we can modify
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Create a Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value;
        },
        set(name, value, options) {
          // This is used for setting cookies in the response
          response.cookies.set({
            name,
            value,
            ...options,
            // Set default options if not provided
            path: options?.path || '/',
            sameSite: options?.sameSite || 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: options?.maxAge || 60 * 60 * 8, // 8 hours
          });
        },
        remove(name, options) {
          // This is used for removing cookies in the response
          response.cookies.set({
            name,
            value: '',
            ...options,
            // Set default options if not provided
            path: options?.path || '/',
            sameSite: options?.sameSite || 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 0,
          });
        },
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        flowType: 'pkce',
      },
    }
  );

  try {
    // Define protected routes that require authentication
    const protectedRoutes = [
      '/dashboard',
      '/dashboard/learn',
      '/dashboard/history',
      '/dashboard/subscription',
      '/dashboard/suggest',
      '/auth/reset-password',
    ];

    // Define auth routes
    const authRoutes = [
      '/auth/sign-in',
      '/auth/sign-up',
      '/auth/forgot-password',
    ];

    // Define callback routes that should be excluded from auth checks
    const callbackRoutes = [
      '/auth/callback',
    ];

    // Check if the current path is a protected route
    const isProtectedRoute = protectedRoutes.some(route => 
      request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(route + '/')
    );

    // Check if the current path is an auth route
    const isAuthRoute = authRoutes.some(route => 
      request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(route + '/')
    );

    // Check if the current path is a callback route
    const isCallbackRoute = callbackRoutes.some(route => 
      request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(route + '/')
    );

    // Skip middleware for callback routes
    if (isCallbackRoute) {
      return response;
    }

    // Get the user session
    const { data, error } = await supabase.auth.getSession();
    const session = data?.session;
    const user = session?.user;

    // Debug logging
    console.log('Middleware path:', request.nextUrl.pathname);
    console.log('Session exists:', !!session);
    console.log('User exists:', !!user);

    // If it's a protected route and no user, redirect to sign-in
    if (isProtectedRoute && (!user || error)) {
      console.log('Redirecting to sign-in from protected route');
      const redirectUrl = new URL('/auth/sign-in', request.url);
      redirectUrl.searchParams.set('redirectedFrom', request.nextUrl.pathname);
      // Add a timestamp to prevent caching issues
      redirectUrl.searchParams.set('t', Date.now().toString());
      return NextResponse.redirect(redirectUrl);
    }

    // If it's an auth route and user is logged in, redirect to dashboard
    if (isAuthRoute && user && !error) {
      console.log('Redirecting to dashboard from auth route');
      // Check if we're already in a redirect loop
      const redirectCount = parseInt(request.nextUrl.searchParams.get('redirect_count') || '0');
      
      // If we've redirected too many times, just return the response to break the loop
      if (redirectCount > 2) {
        console.log('Breaking potential redirect loop after multiple redirects');
        return response;
      }
      
      const dashboardUrl = new URL('/dashboard', request.url);
      // Add a timestamp to prevent caching issues
      dashboardUrl.searchParams.set('t', Date.now().toString());
      // Increment redirect count
      dashboardUrl.searchParams.set('redirect_count', (redirectCount + 1).toString());
      return NextResponse.redirect(dashboardUrl);
    }

    // For all other routes, continue with the response
    return response;
  } catch (error) {
    console.error('Middleware error:', error);
    
    // If there's an error and trying to access protected route, redirect to sign-in
    if (request.nextUrl.pathname.startsWith('/dashboard')) {
      const redirectUrl = new URL('/auth/sign-in', request.url);
      // Add a timestamp to prevent caching issues
      redirectUrl.searchParams.set('t', Date.now().toString());
      return NextResponse.redirect(redirectUrl);
    }
    
    return response;
  }
}

// Only run middleware on specific paths
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/auth/:path*',
  ],
}; 