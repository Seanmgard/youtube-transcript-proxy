'use client'

import { useState, useEffect, Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import useAuthRedirect from '@/hooks/useAuthRedirect'
import { Loader2 } from 'lucide-react'

// Create a separate component that uses useSearchParams
function SignInForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectedFrom') || '/dashboard'
  const errorMessage = searchParams.get('error')

  // Use our custom hook for auth redirection
  const { session, loading: authLoading } = useAuthRedirect({ 
    authRoute: true,
    redirectTo: redirectTo as string
  });

  // Show error message from URL if present
  useEffect(() => {
    if (errorMessage) {
      toast({
        title: 'Error',
        description: decodeURIComponent(errorMessage),
        variant: 'destructive',
      });
    }
  }, [errorMessage, toast]);

  const clearAuthCookies = () => {
    const cookiesToClear = [
      'sb-refresh-token',
      'sb-access-token',
      'sb-auth-token'
    ];
    
    cookiesToClear.forEach(cookieName => {
      document.cookie = `${cookieName}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure; samesite=lax`;
    });
  };

  // Handle Google OAuth sign-in
  async function handleGoogleSignIn() {
    if (googleLoading) return;
    setGoogleLoading(true);
    
    try {
      const supabase = createClient();
      if (!supabase) {
        throw new Error('Failed to initialize Supabase client');
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('Google sign-in error:', error);
        throw error;
      }

      // The redirect will be handled by the OAuth provider
      // No need to handle response here as user will be redirected
      
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      toast({
        title: 'Error signing in with Google',
        description: error.message || 'An error occurred during Google sign in',
        variant: 'destructive',
      });
      setGoogleLoading(false);
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    
    if (loading) return;
    setLoading(true)
    
    try {
      // Form validation
      if (!email || !password) {
        throw new Error('Email and password are required');
      }
      
      // Get a fresh Supabase client
      const supabase = createClient();
      if (!supabase) {
        throw new Error('Failed to initialize Supabase client');
      }

      // Clear any existing auth cookies before attempting sign in
      clearAuthCookies();
      
      // Attempt to sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('Sign-in error:', error);
        
        // Handle specific error cases
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password');
        }
        
        // Handle rate limiting
        if (error.message.includes('Too many requests')) {
          throw new Error('Too many sign-in attempts. Please try again later.');
        }
        
        throw error;
      }
      
      if (!data.session) {
        throw new Error('Failed to establish a valid session');
      }
      
      // Reset retry count on successful sign in
      setRetryCount(0);
      
      // Log session details to help debug
      console.log('Session established:', !!data.session);
      console.log('User ID:', data.session.user.id);
      
      toast({
        title: 'Signed in successfully',
        description: 'Redirecting to dashboard...',
      });
      
      // The useAuthRedirect hook will handle the redirection
      
    } catch (error: any) {
      console.error('Sign-in error:', error);
      
      // Increment retry count
      setRetryCount(prev => prev + 1);
      
      // If too many retries, suggest password reset
      if (retryCount >= 2) {
        toast({
          title: 'Multiple failed attempts',
          description: (
            <div>
              <p>{error.message}</p>
              <p className="mt-2">
                <Link href="/auth/forgot-password" className="underline">
                  Forgot your password?
                </Link>
              </p>
            </div>
          ),
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error signing in',
          description: error.message || 'An error occurred during sign in',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  }

  // Don't render until we've checked the session
  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-2">
      <div className="w-full max-w-md space-y-8 px-4 sm:px-6">
        <div className="space-y-6">
          <h1 className="text-4xl font-bold tracking-tight text-center">
            Welcome back
          </h1>
          <p className="text-center text-muted-foreground">
            Enter your credentials to access your account
          </p>
        </div>

        <div className="space-y-6">
          {/* Google Sign-in Button */}
          <Button
            type="button"
            variant="outline"
            className="w-full bg-white border-gray-300 hover:bg-gray-50 text-gray-700"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
          >
            {googleLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </>
            )}
          </Button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleSignIn} className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                  placeholder="you@example.com"
                  disabled={loading || googleLoading}
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-sm text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1"
                  disabled={loading || googleLoading}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || googleLoading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{' '}
          <Link
            href="/auth/sign-up"
            className="text-primary hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

// Main page component
export default function SignInPage() {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={
        <div className="flex min-h-screen flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      }>
        <SignInForm />
      </Suspense>
    </div>
  );
} 