'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Mail, ArrowLeft } from 'lucide-react'

export default function ConfirmPage() {
  const [isResending, setIsResending] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email')

  useEffect(() => {
    // Check if user is already signed in
    const checkSession = async () => {
      try {
        const supabase = await createClient();
        const { data } = await supabase.auth.getSession();
        
        if (data.session) {
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('Error checking session:', error);
      }
    };
    
    checkSession();
  }, [router]);

  const resendConfirmation = async () => {
    if (!email || isResending) return;
    
    setIsResending(true);
    
    try {
      const supabase = await createClient();
      
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent('/dashboard')}`,
        }
      });
      
      if (error) {
        throw error;
      }
      
      toast({
        title: 'Confirmation email sent!',
        description: 'Please check your email for the confirmation link.',
      });
      
    } catch (error: any) {
      toast({
        title: 'Error resending email',
        description: error.message || 'Failed to resend confirmation email',
        variant: 'destructive',
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto h-24 w-24 bg-blue-100 rounded-full flex items-center justify-center mb-6">
            <Mail className="h-12 w-12 text-blue-600" />
          </div>
          
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            Check your email
          </h2>
          
          <p className="mt-4 text-lg text-gray-600">
            We've sent a confirmation link to:
          </p>
          
          {email && (
            <p className="mt-2 text-xl font-semibold text-gray-900">
              {email}
            </p>
          )}
          
          <p className="mt-4 text-sm text-gray-500">
            Click the link in the email to complete your account setup and access your dashboard.
          </p>
        </div>

        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-4">
              Didn't receive the email?
            </p>
            
            <Button
              onClick={resendConfirmation}
              disabled={isResending || !email}
              variant="outline"
              className="w-full"
            >
              {isResending ? 'Sending...' : 'Resend confirmation email'}
            </Button>
          </div>
          
          <div className="text-center">
            <Link
              href="/auth/sign-in"
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-500"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to sign in
            </Link>
          </div>
        </div>

        <div className="border-t pt-6">
          <p className="text-xs text-gray-500 text-center">
            Make sure to check your spam folder if you don't see the email in your inbox.
          </p>
        </div>
      </div>
    </div>
  );
} 