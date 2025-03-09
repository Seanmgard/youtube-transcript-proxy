import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  // Create a response object that we can modify
  let response = NextResponse.next();

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
    }
  );

  // Define protected routes that require authentication
  const protectedRoutes = [
    '/dashboard',
    '/dashboard/learn',
    '/dashboard/history',
    '/dashboard/subscription',
    '/dashboard/suggest',
  ];

  // Check if the current path is a protected route
  const isProtectedRoute = protectedRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  );

  // If it's a protected route, check if the user is authenticated
  if (isProtectedRoute) {
    // Use getUser() instead of getSession() for better security
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      // Redirect to sign-in if not authenticated
      const redirectUrl = new URL('/auth/sign-in', request.url);
      redirectUrl.searchParams.set('redirectedFrom', request.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

// Only run middleware on specific paths
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/auth/:path*',
  ],
}; 