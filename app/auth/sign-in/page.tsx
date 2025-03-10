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

// Create a separate component that uses useSearchParams
function SignInForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
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
      
      // Use direct Supabase auth instead of the API route
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('Sign-in error:', error);
        throw error;
      }
      
      if (!data.session) {
        throw new Error('Failed to establish a valid session');
      }
      
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
      toast({
        title: 'Error signing in',
        description: error.message || 'An error occurred during sign in',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  // Don't render until we've checked the session
  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-2">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to your account</h1>
          <p className="text-sm text-muted-foreground">
            Enter your email and password to sign in
          </p>
        </div>
        <div className="grid gap-6">
          <form onSubmit={handleSignIn}>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  placeholder="name@example.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>
            </div>
          </form>
          <div className="text-center">
            <Link 
              href="/auth/forgot-password" 
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-primary"
            >
              Forgot your password?
            </Link>
          </div>
        </div>
        <div className="px-8 text-center text-sm text-muted-foreground">
          Don't have an account?{' '}
          <Link href="/auth/sign-up" className="underline underline-offset-4 hover:text-primary">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  )
}

// Main component with Suspense boundary
export default function SignIn() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    }>
      <SignInForm />
    </Suspense>
  )
} 