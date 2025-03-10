'use client'

import { useState, useEffect, Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

// Create a separate component for the sign-up form
function SignUpForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
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
      // Form validation
      if (!email || !password || !firstName || !lastName) {
        throw new Error('Please fill in all required fields');
      }
      
      // Get the Supabase client - properly awaited
      const supabase = await createClient();
      
      // First check if the email already exists
      const { data: existingUsers, error: lookupError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .limit(1);
        
      if (lookupError) {
        console.error('Error checking existing user:', lookupError);
      } else if (existingUsers && existingUsers.length > 0) {
        throw new Error('This email is already registered. Please sign in instead.');
      }
      
      // Use direct Supabase auth instead of the API route
      // This avoids potential issues with cookie handling between client and server
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      
      if (error) {
        console.error('Sign-up error:', error);
        throw error;
      }
      
      // Check if email confirmation is needed
      const emailConfirmationNeeded = data?.user && !data.session;
      
      if (emailConfirmationNeeded) {
        toast({
          title: 'Account created successfully',
          description: 'Please check your email for a confirmation link.',
        });
      } else {
        toast({
          title: 'Account created successfully',
          description: 'You can now sign in with your new account.',
        });
      }
      
      // Redirect to sign-in page
      setTimeout(() => {
        router.push('/auth/sign-in');
      }, 1500);
    } catch (error: any) {
      console.error('Sign-up error:', error);
      toast({
        title: 'Error creating account',
        description: error.message || 'An error occurred during sign up',
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
          <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
          <p className="text-sm text-muted-foreground">
            Enter your details below to create your account
          </p>
        </div>
        <div className="grid gap-6">
          <form onSubmit={handleSignUp}>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    placeholder="John"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>
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
                {loading ? 'Creating account...' : 'Create account'}
              </Button>
            </div>
          </form>
        </div>
        <div className="px-8 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/auth/sign-in" className="underline underline-offset-4 hover:text-primary">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}

// Main component with Suspense boundary
export default function SignUp() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    }>
      <SignUpForm />
    </Suspense>
  )
} 