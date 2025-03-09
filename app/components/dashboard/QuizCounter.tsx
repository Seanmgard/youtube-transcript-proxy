'use client';

import { useState, useEffect, useRef } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { Progress } from '@/app/components/ui/progress';
import { FileText } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { createClient } from '@/utils/supabase/client';
import { useToast } from "@/components/ui/use-toast";
import React from 'react';

export function QuizCounter() {
  const [quizCount, setQuizCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { isOnPlan, subscription, fetchSubscription } = useSubscription();
  const { user } = useAuth();
  const { toast } = useToast();
  const isPremium = isOnPlan('premium');
  const quizLimit = isPremium ? Infinity : 10;
  const hasAttemptedFetch = useRef(false);

  const fetchQuizCount = async () => {
    try {
      setIsLoading(true);
      
      // Check if user is authenticated
      if (!user) {
        console.log('No authenticated user found');
        return;
      }
      
      // Get the current date
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      // Format dates for Supabase query
      const startDate = firstDayOfMonth.toISOString();
      const endDate = lastDayOfMonth.toISOString();
      
      // Properly await the Supabase client
      const supabase = await createClient();
      
      // Query quizzes created by the current user in the current month
      const { count, error } = await supabase
        .from('quizzes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      
      if (error) {
        // Log detailed error information
        console.error('Error fetching quiz count details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          status: error.status,
          error: JSON.stringify(error)
        });
        
        // Show a toast notification with the error message
        toast({
          title: "Error fetching quiz count",
          description: error.message || "Could not retrieve your quiz usage. Please try again later.",
          variant: "destructive",
        });
        return;
      }
      
      setQuizCount(count || 0);
    } catch (error) {
      console.error('Error in fetchQuizCount:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh subscription data when it changes
  useEffect(() => {
    // Fetch quiz count when component mounts
    fetchQuizCount();
    
    // Use the ref that's now defined at the top level
    if (user && !hasAttemptedFetch.current) {
      hasAttemptedFetch.current = true;
      
      try {
        fetchSubscription(true).catch(err => {
          console.error('Error fetching subscription:', err);
        });
      } catch (err) {
        console.error('Error in subscription effect:', err);
      }
    }
  }, [user, fetchSubscription]);

  useEffect(() => {
    // Only fetch if user is authenticated
    if (user) {
      // Initial fetch
      fetchQuizCount();
      
      // Set up a subscription to listen for new quizzes
      const setupSubscription = async () => {
        try {
          const supabase = await createClient();
          
          const channel = supabase
            .channel('quiz-counter')
            .on('postgres_changes', { 
              event: 'INSERT', 
              schema: 'public', 
              table: 'quizzes' 
            }, () => {
              fetchQuizCount();
            })
            .on('postgres_changes', { 
              event: 'DELETE', 
              schema: 'public', 
              table: 'quizzes' 
            }, () => {
              fetchQuizCount();
            })
            .subscribe();
            
          // Return cleanup function
          return () => {
            supabase.removeChannel(channel);
          };
        } catch (error) {
          console.error('Error setting up subscription:', error);
          return () => {}; // Empty cleanup function
        }
      };
      
      // Set up the subscription
      let cleanupFn: (() => void) | undefined;
      
      // Start the setup process
      setupSubscription().then(cleanup => {
        cleanupFn = cleanup;
      }).catch(err => {
        console.error('Error in subscription setup:', err);
      });
      
      // Set up a refresh interval (every 30 seconds)
      const intervalId = setInterval(() => {
        fetchQuizCount();
      }, 30000);
      
      return () => {
        // Clean up the interval
        clearInterval(intervalId);
        
        // Clean up the subscription if available
        if (cleanupFn) {
          cleanupFn();
        }
      };
    }
  }, [user, isPremium]);

  // Also listen for subscription changes
  useEffect(() => {
    // When subscription changes, refresh the quiz count
    if (subscription) {
      fetchQuizCount();
    }
  }, [subscription]);
  
  // If no user, don't show the counter
  if (!user) {
    return null;
  }
  
  const progressValue = quizLimit === Infinity ? 0 : (quizCount / quizLimit) * 100;
  
  return (
    <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center mb-2">
        <FileText className="h-4 w-4 mr-2 text-primary" />
        <span className="text-sm font-medium">Quiz Usage</span>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {quizCount} / {isPremium ? '∞' : quizLimit} this month
          </span>
          {!isPremium && quizCount >= quizLimit && (
            <span className="text-xs text-red-500 font-medium">Limit reached</span>
          )}
        </div>
        
        <Progress 
          value={progressValue} 
          className="h-2" 
          indicatorClassName={
            progressValue > 90 
              ? "bg-red-500" 
              : progressValue > 70 
                ? "bg-amber-500" 
                : "bg-primary"
          }
        />
        
        {!isPremium && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {quizLimit - quizCount <= 0 
              ? 'Upgrade to Premium for unlimited quizzes' 
              : `${quizLimit - quizCount} quizzes remaining`}
          </p>
        )}
        {isPremium && (
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
            Premium plan - Unlimited quizzes
          </p>
        )}
      </div>
    </div>
  );
} 