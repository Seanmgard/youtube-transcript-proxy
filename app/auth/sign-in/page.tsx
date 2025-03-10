'use client'

import { useState, useEffect, Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

// Create a separate component that uses useSearchParams
function SignInForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectedFrom') || '/dashboard'

  // Check if user is already signed in
  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = await createClient();
        const { data } = await supabase.auth.getSession();
        
        // If user already has a valid session, redirect to dashboard
        if (data.session) {
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('Error checking session:', error);
      } finally {
        setIsInitialized(true);
      }
    };
    
    checkSession();
  }, [router]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    
    if (loading) return;
    setLoading(true)
    
    try {
      // Form validation
      if (!email || !password) {
        throw new Error('Email and password are required');
      }
      
      // Use server-side API for sign-in to avoid CORS issues
      const formData = new FormData();
      formData.append('email', email);
      formData.append('password', password);
      
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to sign in');
      }
      
      toast({
        title: 'Signed in successfully',
        description: 'Redirecting to dashboard...',
      });
      
      // Get a fresh Supabase client to ensure we have the latest session
      const supabase = await createClient();
      
      // Force a session refresh to ensure cookies are properly set
      await supabase.auth.refreshSession();
      
      // Get the current session to verify it's valid
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session) {
        throw new Error('Failed to establish a valid session');
      }
      
      // Use a full page reload to ensure proper session handling
      setTimeout(() => {
        window.location.href = redirectTo;
      }, 1000);
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
  if (!isInitialized) {
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