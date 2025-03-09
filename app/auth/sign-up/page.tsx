'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (loading) return;
    setLoading(true)
    
    try {
      // Get the Supabase client - properly awaited
      const supabase = await createClient();
      
      // Use direct Supabase auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
          },
        },
      })
      
      if (error) {
        throw error
      }
      
      if (data?.user) {
        // Create a profile record
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            { 
              id: data.user.id,
              first_name: firstName,
              email: email,
            },
          ])
        
        if (profileError) {
          console.error('Error creating profile:', profileError)
          // Continue anyway - the profile might be created by a trigger
        }
        
        toast({
          title: 'Account created successfully',
          description: 'Please check your email to confirm your account.',
        })
        
        // Add a delay before redirecting
        setTimeout(() => {
          router.push('/sign-in')
        }, 1000)
      }
    } catch (error: any) {
      toast({
        title: 'Error creating account',
        description: error.message || 'An error occurred during sign up',
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
            Create your account
          </h2>
        </div>

        <form onSubmit={handleSignUp} className="mt-8 space-y-6">
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                name="firstName"
                type="text"
                autoComplete="given-name"
                required
                className="mt-1"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>

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
                autoComplete="new-password"
                required
                className="mt-1"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                Password must be at least 6 characters
              </p>
            </div>
          </div>

          <div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Sign up'}
            </Button>
          </div>
        </form>

        <p className="mt-2 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link
            href="/auth/sign-in"
            className="font-medium text-primary hover:text-primary/80"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
} 