'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { useToast } from '@/app/components/ui/use-toast'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

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
      // Get the Supabase client - properly awaited
      const supabase = await createClient();
      
      // Use direct Supabase auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) {
        throw error
      }
      
      if (data?.user) {
        toast({
          title: 'Signed in successfully',
          description: 'Redirecting to dashboard...',
        })
        
        // Add a delay before redirecting to ensure cookies are set
        setTimeout(() => {
          router.push('/dashboard')
        }, 1000)
      }
    } catch (error: any) {
      toast({
        title: 'Error signing in',
        description: error.message || 'An error occurred during sign in',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
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
    <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 pt-24">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight">
            Sign in to your account
          </h2>
        </div>

        <form onSubmit={handleSignIn} className="mt-8 space-y-6">
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-1"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </div>
        </form>

        <p className="mt-2 text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <Link
            href="/auth/sign-up"
            className="font-medium text-primary hover:text-primary/80"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
} 