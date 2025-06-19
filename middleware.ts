import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

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
  '/auth/confirm',
];

const CALLBACK_ROUTES = [
  '/auth/callback',
];

// Define public routes that should be accessible without authentication
const PUBLIC_ROUTES = [
  '/privacy',
  '/terms',
  '/contact',
];

export async function middleware(request: NextRequest) {
  // IMPORTANT: Check for public routes FIRST, before any try/catch or authentication logic
  const isPublicRoute = PUBLIC_ROUTES.some(route => 
    request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(`${route}/`)
  );
  
  if (isPublicRoute) {
    console.log(`Allowing public route without auth check: ${request.nextUrl.pathname}`);
    // Return immediately without any auth checks for public routes
    return NextResponse.next();
  }

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
          get(name) {
            try {
              return request.cookies.get(name)?.value;
            } catch (error) {
              console.error(`Error getting cookie ${name}:`, error);
              return undefined;
            }
          },
          set(name, value, options) {
            try {
              response.cookies.set({
                name,
                value,
                ...options,
              });
            } catch (error) {
              console.error(`Error setting cookie ${name}:`, error);
            }
          },
          remove(name, options) {
            try {
              response.cookies.set({
                name,
                value: '',
                ...options,
              });
            } catch (error) {
              console.error(`Error removing cookie ${name}:`, error);
            }
          },
        },
      }
    );

    // Special handling for callback routes
    if (CALLBACK_ROUTES.some(route => request.nextUrl.pathname === route)) {
      return response;
    }

    try {
      // Try to get the user's session
      await supabase.auth.getSession();
      
      // Get the user
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error) {
        console.error('Auth error:', error);
        if (PROTECTED_ROUTES.some(route => request.nextUrl.pathname.startsWith(route))) {
          const redirectUrl = new URL('/auth/sign-in', request.url);
          redirectUrl.searchParams.set('redirectedFrom', request.nextUrl.pathname);
          return NextResponse.redirect(redirectUrl);
        }
      }

      // Check if the user is trying to access a protected route
      const isProtectedRoute = PROTECTED_ROUTES.some(route => 
        request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(`${route}/`)
      );

      // Check if the user is trying to access an auth route
      const isAuthRoute = AUTH_ROUTES.some(route => 
        request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(`${route}/`)
      );

      // If the user is not authenticated and trying to access a protected route, redirect to sign-in
      if (isProtectedRoute && !user) {
        const redirectUrl = new URL('/auth/sign-in', request.url);
        redirectUrl.searchParams.set('redirectedFrom', request.nextUrl.pathname);
        return NextResponse.redirect(redirectUrl);
      }

      // If the user is authenticated and trying to access an auth route, redirect to dashboard
      if (isAuthRoute && user) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    } catch (error) {
      console.error('Authentication error in middleware:', error);
      
      // If there's an auth error and trying to access protected route, redirect to sign-in
      if (PROTECTED_ROUTES.some(route => request.nextUrl.pathname.startsWith(route))) {
        return NextResponse.redirect(new URL('/auth/sign-in', request.url));
      }
    }

    return response;
  } catch (e) {
    console.error('Middleware error:', e);
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|public/).*)'],
}; 