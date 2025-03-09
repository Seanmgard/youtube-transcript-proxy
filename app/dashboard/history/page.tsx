'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import QuizHistory from '@/app/components/QuizHistory';
import { Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/components/ui/use-toast';
import { createClient } from '@/utils/supabase/client';

export default function HistoryPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const [supabase, setSupabase] = useState<any>(null);

  useEffect(() => {
    const initSupabase = async () => {
      const client = await createClient();
      setSupabase(client);
    };
    
    initSupabase();
  }, []);

  useEffect(() => {
    if (!supabase) return;
    
    const checkAuth = async () => {
      try {
        setLoading(true);
        
        // First try to get the session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          throw sessionError;
        }
        
        // If no session, try to refresh it
        if (!session) {
          // Try to refresh the session
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError) {
            console.error('Error refreshing session:', refreshError);
            throw refreshError;
          }
          
          if (!refreshData.session) {
            // Still no session after refresh, redirect to login
            toast({
              title: 'Authentication Required',
              description: 'Please sign in to view your quiz history.',
              variant: 'destructive',
            });
            router.push('/auth/sign-in');
            return;
          }
          
          setUser(refreshData.user);
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
        router.push('/auth/sign-in');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [supabase, router, toast]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!authChecked) {
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
        <QuizHistory showAll={true} />
      </div>
    </div>
  );
} 