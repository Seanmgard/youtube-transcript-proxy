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
                disabled={loading}
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
                disabled={loading}
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
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