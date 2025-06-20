'use client'

import { useState, useEffect, Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

function ResetPasswordForm() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = await createClient();
        const { data } = await supabase.auth.getSession();
        
        if (data.session) {
          setHasSession(true);
        } else {
          // No session, redirect to sign-in
          toast({
            title: 'Session expired',
            description: 'Your password reset link has expired. Please request a new one.',
            variant: 'destructive',
          });
          setTimeout(() => {
            router.push('/auth/forgot-password');
          }, 2000);
        }
      } catch (error) {
        console.error('Error checking session:', error);
        toast({
          title: 'Error',
          description: 'An error occurred while checking your session',
          variant: 'destructive',
        });
      }
    };
    
    checkSession();
  }, [router, toast]);

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    
    if (loading) return;
    setLoading(true)
    
    try {
      if (!password || !confirmPassword) {
        throw new Error('Please fill in all fields');
      }
      
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match');
      }
      
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }
      
      const supabase = await createClient();
      
      const { error } = await supabase.auth.updateUser({
        password,
      });
      
      if (error) {
        throw error;
      }
      
      setSuccess(true);
      toast({
        title: "🔒 Password Updated",
        description: "Your password has been successfully updated. You will be redirected to sign in.",
        className: "border-green-200 bg-green-50 text-green-900",
        duration: 4000,
      });
      
      // Sign out the user after password reset
      setTimeout(async () => {
        await supabase.auth.signOut();
        router.push('/auth/sign-in');
      }, 2000);
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast({
        title: 'Error',
        description: error.message || 'An error occurred while resetting your password',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  if (!hasSession) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center py-2">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Password updated</h1>
            <p className="text-sm text-muted-foreground">
              Your password has been successfully updated. You will be redirected to the sign-in page.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-2">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
          <p className="text-sm text-muted-foreground">
            Enter your new password below
          </p>
        </div>
        <div className="grid gap-6">
          <form onSubmit={handleResetPassword}>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Updating...' : 'Reset Password'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function ResetPassword() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
} 