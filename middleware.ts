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
          });
        },
        remove(name, options) {
          // This is used for removing cookies in the response
          response.cookies.set({
            name,
            value: '',
            ...options,
            maxAge: 0,
          });
        },
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
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
    ];

    // Define auth routes
    const authRoutes = [
      '/auth/sign-in',
      '/auth/sign-up',
      '/auth/forgot-password',
    ];

    // Check if the current path is a protected route
    const isProtectedRoute = protectedRoutes.some(route => 
      request.nextUrl.pathname.startsWith(route)
    );

    // Check if the current path is an auth route
    const isAuthRoute = authRoutes.some(route => 
      request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(route)
    );

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
      return NextResponse.redirect(redirectUrl);
    }

    // If it's an auth route and user is logged in, redirect to dashboard
    if (isAuthRoute && user && !error) {
      console.log('Redirecting to dashboard from auth route');
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // For all other routes, continue with the response
    return response;
  } catch (error) {
    console.error('Middleware error:', error);
    
    // If there's an error and trying to access protected route, redirect to sign-in
    if (request.nextUrl.pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/auth/sign-in', request.url));
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