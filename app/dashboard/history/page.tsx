'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import QuizHistory from '@/app/components/QuizHistory';
import { Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/components/ui/use-toast';

// Initialize Supabase client outside component
const supabase = createClientComponentClient();

export default function HistoryPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Memoize the checkAuth function to prevent recreating it on each render
  const checkAuth = useCallback(async (retryCount = 0) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // 1 second delay between retries

    try {
      setLoading(true);
      
      // First try to get the session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        throw sessionError;
      }
      
      // If no session, try to refresh it with retry logic
      if (!session) {
        if (retryCount >= MAX_RETRIES) {
          toast({
            title: 'Authentication Failed',
            description: 'Unable to refresh session. Please sign in again.',
            variant: 'destructive',
          });
          router.replace('/auth/sign-in');
          return;
        }

        try {
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError) {
            console.error('Error refreshing session:', refreshError);
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            return checkAuth(retryCount + 1);
          }
          
          if (!refreshData.session) {
            toast({
              title: 'Authentication Required',
              description: 'Please sign in to view your quiz history.',
              variant: 'destructive',
            });
            router.replace('/auth/sign-in');
            return;
          }
          
          setUser(refreshData.session.user);
        } catch (refreshError) {
          console.error('Session refresh error:', refreshError);
          if (retryCount < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            return checkAuth(retryCount + 1);
          }
          throw refreshError;
        }
      } else {
        setUser(session.user);
      }
      
      setAuthChecked(true);
    } catch (error) {
      console.error('Authentication error:', error);
      toast({
        title: 'Authentication Error',
        description: 'There was a problem with your authentication. Please try signing in again.',
        variant: 'destructive',
      });
      router.replace('/auth/sign-in');
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

  // Run auth check only once on mount
  useEffect(() => {
    checkAuth();
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.replace('/auth/sign-in');
      } else if (event === 'SIGNED_IN' && session) {
        setUser(session.user);
        setAuthChecked(true);
      }
    });

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [checkAuth, router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!authChecked || !user) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Verifying authentication...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/dashboard">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Quiz History</h1>
      </div>

      <div className="p-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
        <h2 className="text-xl font-semibold mb-6">All Quizzes</h2>
        <QuizHistory showAll={true} user={user} supabase={supabase} />
      </div>
    </div>
  );
} 