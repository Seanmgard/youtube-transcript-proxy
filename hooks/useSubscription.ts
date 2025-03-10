import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';
import { createClient } from '@/utils/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/app/providers/AuthProvider';

type SubscriptionStatus = 'free' | 'premium';
type PlanType = 'premium' | 'premium_annual';

interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  status: string;
  plan_type: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

// Add a debounce mechanism at the top of the file
let fetchInProgress = false;
let lastSubscriptionRefresh = 0;
let lastErrorTime = 0;
let errorCount = 0;
const ERROR_COOLDOWN = 5000; // 5 seconds cooldown between error logs
const MAX_ERROR_COUNT = 3; // Maximum number of consecutive errors before backing off
const REFRESH_COOLDOWN = 10000; // 10 seconds minimum between refreshes

export function useSubscription() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();

  // Create a default free subscription for a user
  const createDefaultSubscription = async (userId: string) => {
    try {
      // Properly await the Supabase client
      const supabase = await createClient();
      
      // Create a new subscription record with minimal required fields
      const newSubscription = {
        user_id: userId,
        status: 'active',
        plan_type: 'free' as SubscriptionStatus,
      };
      
      const { data, error: insertError } = await supabase
        .from('subscriptions')
        .insert([newSubscription])
        .select()
        .single();
      
      if (insertError) {
        // Check if this is an RLS policy error
        if (insertError.code === '42501' || (insertError.message && insertError.message.includes('row-level security policy'))) {
          console.error('RLS policy error creating default subscription:', insertError);
          
          // Throw a more specific error with the code included
          const error = new Error('Row-level security policy prevented creating a subscription');
          (error as any).code = '42501';
          (error as any).originalError = insertError;
          throw error;
        } else {
          console.error('Error creating default subscription:', insertError);
          throw insertError;
        }
      }
      
      return data as Subscription;
    } catch (error) {
      console.error('Error in createDefaultSubscription:', error);
      throw error;
    }
  };

  // Fetch the user's subscription
  const fetchSubscription = useCallback(async (userId?: string, forceRefresh = false) => {
    try {
      // Prevent concurrent fetches and implement debouncing
      if (fetchInProgress) {
        console.log('Subscription fetch already in progress, skipping');
        return subscription;
      }
      
      // If we're not forcing a refresh and we've fetched recently, skip
      const now = Date.now();
      if (!forceRefresh && now - lastSubscriptionRefresh < REFRESH_COOLDOWN && subscription) {
        console.log('Skipping fetch due to recent refresh', {
          timeSinceLastRefresh: now - lastSubscriptionRefresh,
          cooldown: REFRESH_COOLDOWN
        });
        return subscription;
      }
      
      // Check if we've had too many errors recently and should back off
      if (errorCount >= MAX_ERROR_COUNT && now - lastErrorTime < ERROR_COOLDOWN * Math.pow(2, errorCount - MAX_ERROR_COUNT)) {
        console.log(`Too many recent errors (${errorCount}), backing off before retrying`);
        return subscription;
      }
      
      // Set fetch in progress flag
      fetchInProgress = true;
      
      setIsLoading(true);
      setError(null);

      // Use provided userId or fall back to user from context
      const currentUserId = userId || user?.id;

      if (!currentUserId) {
        // Not authenticated, just set a null subscription and don't show an error
        setSubscription(null);
        setIsLoading(false);
        fetchInProgress = false; // Reset flag
        lastSubscriptionRefresh = now; // Update timestamp even for null results
        return null;
      }

      // Initialize Supabase client
      const supabase = await createClient();
      
      try {
        // Query the user's subscription
        const { data: subscriptionData, error: subscriptionError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', currentUserId)
          .single();
        
        if (subscriptionError) {
          if (subscriptionError.code === 'PGRST116') {
            // No subscription found, try to create a default one
            console.log(`No subscription found for user ${currentUserId}, creating default`);
            
            try {
              const defaultSubscription = await createDefaultSubscription(currentUserId);
              setSubscription(defaultSubscription);
              lastSubscriptionRefresh = now;
              errorCount = 0; // Reset error count on success
              return defaultSubscription;
            } catch (createError: any) {
              console.error('Error creating default subscription:', createError);
              
              // If this is an RLS policy error, create a client-side fallback subscription
              // This prevents constant retries that would flood the console with errors
              if (createError.code === '42501' || (createError.message && createError.message.includes('row-level security policy'))) {
                console.log('Using client-side fallback subscription due to RLS policy restrictions');
                
                // Create a client-side fallback subscription object
                const fallbackSubscription: Subscription = {
                  id: `fallback-${uuidv4()}`,
                  user_id: currentUserId,
                  stripe_customer_id: null,
                  stripe_subscription_id: null,
                  stripe_price_id: null,
                  status: 'active',
                  plan_type: 'free',
                  current_period_start: null,
                  current_period_end: null,
                  cancel_at_period_end: false,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                };
                
                setSubscription(fallbackSubscription);
                lastSubscriptionRefresh = now;
                
                // Show a toast notification to the user
                toast({
                  title: 'Subscription Status',
                  description: 'Using free plan features. Contact support if you believe this is an error.',
                  variant: 'default',
                });
                
                // Don't increment error count for RLS errors since we're handling them
              } else {
                // For other errors, increment the error count and set the error
                lastErrorTime = now;
                errorCount++;
                setError(new Error(`Failed to create default subscription: ${createError.message}`));
              }
            }
          } else {
            // Some other error occurred
            console.error('Error fetching subscription:', subscriptionError);
            lastErrorTime = now;
            errorCount++;
            setError(new Error(`Failed to fetch subscription: ${subscriptionError.message}`));
          }
        } else {
          // Successfully fetched subscription
          setSubscription(subscriptionData);
          lastSubscriptionRefresh = now;
          errorCount = 0; // Reset error count on success
          return subscriptionData;
        }
      } catch (error: any) {
        console.error('Unexpected error in fetchSubscription:', error);
        lastErrorTime = now;
        errorCount++;
        setError(new Error(`Unexpected error: ${error.message}`));
      }
    } catch (error) {
      console.error('Error in fetchSubscription:', error);
      setError(error as Error);
      
      // Set a default free subscription in the UI to prevent blocking the user
      const tempSubscription = {
        id: 'temp-error-catch-' + (user?.id || 'unknown'),
        user_id: user?.id || 'unknown',
        stripe_customer_id: null,
        stripe_subscription_id: null,
        stripe_price_id: null,
        status: 'active',
        plan_type: 'free' as SubscriptionStatus,
        current_period_start: null,
        current_period_end: null,
        cancel_at_period_end: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as Subscription;
      setSubscription(tempSubscription);
      return tempSubscription;
    } finally {
      setIsLoading(false);
      fetchInProgress = false; // Reset flag
    }
  }, [user, subscription, toast]);

  // Create a checkout session for upgrading
  const createCheckoutSession = async (planType: PlanType, couponId?: string) => {
    try {
      setIsLoading(true);
      
      if (!user) {
        console.error('No authenticated user found');
        toast({
          title: 'Authentication Error',
          description: 'Please sign in to upgrade your subscription.',
          variant: 'destructive',
        });
        return { error: 'No authenticated user found' };
      }
      
      // Initialize Supabase client
      const supabase = await createClient();
      
      // Get the session first
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      // Create checkout session
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          planType,
          couponId,
          userId: user.id
        })
      });
      
      // Log the raw response status and headers for debugging
      console.log('Checkout session response status:', response.status);
      
      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        console.error('Non-JSON response from checkout API:', textResponse);
        
        // Show a more user-friendly error message
        toast({
          title: 'Checkout Error',
          description: 'There was a problem connecting to the payment service. Please try again later.',
          variant: 'destructive',
        });
        
        return { error: 'Invalid response format from server' };
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        // Log detailed error information
        console.error('Error creating checkout session:', {
          status: response.status,
          statusText: response.statusText,
          data: data,
          error: data.error || data.message || 'Unknown error'
        });
        
        // Show a more user-friendly error message based on the status code
        let errorMessage = 'Failed to create checkout session. Please try again later.';
        if (response.status === 401) {
          errorMessage = 'Your session has expired. Please sign in again.';
        } else if (response.status === 400) {
          errorMessage = data.message || 'Invalid request. Please try again.';
        } else if (response.status === 500) {
          errorMessage = 'Server error. Our team has been notified.';
        }
        
        toast({
          title: 'Checkout Error',
          description: errorMessage,
          variant: 'destructive',
        });
        
        return { error: data.message || 'Failed to create checkout session' };
      }

      // Store a timestamp to force refresh when returning from Stripe
      localStorage.setItem('subscription_checkout_time', Date.now().toString());
      
      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err: any) {
      console.error('Error creating checkout session:', err);
      toast({
        title: 'Error',
        description: 'Could not redirect to payment page. Please try again later.',
        variant: 'destructive',
      });
      return { error: err.message || 'Unknown error occurred' };
    } finally {
      setIsLoading(false);
    }
  };

  // Create a customer portal session for managing subscription
  const createPortalSession = async () => {
    try {
      setIsLoading(true);
      
      if (!user) {
        console.error('No authenticated user found');
        toast({
          title: 'Authentication Error',
          description: 'Please sign in to manage your subscription.',
          variant: 'destructive',
        });
        return { error: 'No authenticated user found' };
      }
      
      // Initialize Supabase client
      const supabase = await createClient();
      
      // Get the session first
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          userId: user.id
        })
      });
      
      // Log the raw response status and headers for debugging
      console.log('Portal session response status:', response.status);
      
      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        console.error('Non-JSON response from portal API:', textResponse);
        
        // Show a more user-friendly error message
        toast({
          title: 'Portal Error',
          description: 'There was a problem connecting to the billing portal. Please try again later.',
          variant: 'destructive',
        });
        
        return { error: 'Invalid response format from server' };
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        // Log detailed error information
        console.error('Error creating portal session:', {
          status: response.status,
          statusText: response.statusText,
          data: data,
          error: data.error || data.message || 'Unknown error'
        });
        
        // Show a more user-friendly error message based on the status code
        let errorMessage = 'Failed to access billing portal. Please try again later.';
        if (response.status === 401) {
          errorMessage = 'Your session has expired. Please sign in again.';
        } else if (response.status === 404) {
          errorMessage = 'No active subscription found. Please upgrade first.';
        } else if (response.status === 500) {
          errorMessage = 'Server error. Our team has been notified.';
        }
        
        toast({
          title: 'Portal Error',
          description: errorMessage,
          variant: 'destructive',
        });
        
        return { error: data.message || 'Failed to create portal session' };
      }
      
      // Store a timestamp to force refresh when returning from Stripe
      localStorage.setItem('subscription_portal_time', Date.now().toString());
      
      // Redirect to Stripe Customer Portal
      window.location.href = data.url;
    } catch (err: any) {
      // Log detailed error information
      console.error('Error creating portal session:', {
        message: err.message,
        stack: err.stack,
        error: JSON.stringify(err)
      });
      
      toast({
        title: 'Error',
        description: 'Could not access billing portal. Please try again later.',
        variant: 'destructive',
      });
      
      return { error: err.message || 'Failed to create portal session' };
    } finally {
      setIsLoading(false);
    }
  };

  // Check if the subscription is active
  const isSubscriptionActive = () => {
    return subscription?.status === 'active' || subscription?.status === 'trialing';
  };

  // Check if the subscription is on a specific plan
  const isOnPlan = (planType: SubscriptionStatus) => {
    if (!subscription) return planType === 'free';
    return subscription?.plan_type === planType && isSubscriptionActive();
  };

  // Format the subscription end date
  const formatSubscriptionEndDate = () => {
    if (!subscription?.current_period_end) return null;
    
    const date = new Date(subscription.current_period_end);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Initialize the subscription when user changes
  useEffect(() => {
    if (user) {
      // Only fetch if we haven't fetched recently
      const now = Date.now();
      if (now - lastSubscriptionRefresh > REFRESH_COOLDOWN || !subscription) {
        fetchSubscription(false);
      }
    } else {
      setSubscription(null);
      setIsLoading(false);
    }
  }, [user, fetchSubscription, subscription]);

  // Set up a subscription listener when the user changes
  useEffect(() => {
    if (!user) return;
    
    let isSubscriptionSetup = false;
    
    const setupSubscriptionListener = async () => {
      // Prevent multiple setup attempts
      if (isSubscriptionSetup) return;
      isSubscriptionSetup = true;
      
      try {
        const supabase = await createClient();
        
        // Subscribe to changes in the subscriptions table for this user
        const channel = supabase
          .channel('subscription-changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'subscriptions',
              filter: `user_id=eq.${user.id}`
            },
            (payload: any) => {
              console.log('Subscription changed:', payload);
              // Refresh subscription data with a slight delay to avoid race conditions
              setTimeout(() => {
                // Only fetch if we haven't fetched recently
                const now = Date.now();
                if (now - lastSubscriptionRefresh > REFRESH_COOLDOWN) {
                  // Use the current user ID when calling fetchSubscription
                  fetchSubscription(user?.id, true);
                }
              }, 500);
            }
          )
          .subscribe((status: any) => {
            console.log('Subscription channel status:', status);
            if (status === 'SUBSCRIBED') {
              // Initial fetch after successful subscription
              // Only fetch if we haven't fetched recently
              const now = Date.now();
              if (now - lastSubscriptionRefresh > REFRESH_COOLDOWN || !subscription) {
                fetchSubscription(user?.id, false);
              }
            }
          });
          
        return () => {
          console.log('Cleaning up subscription listener');
          // We need to get a new supabase client for cleanup
          // This is a synchronous cleanup function, so we need to handle the async operation differently
          try {
            // Get the existing client instance instead of creating a new one asynchronously
            const client = createClient();
            client.removeChannel(channel);
          } catch (err) {
            console.error('Error removing channel:', err);
          }
          isSubscriptionSetup = false;
        };
      } catch (error) {
        console.error('Error setting up subscription listener:', error);
        isSubscriptionSetup = false;
        // Return a no-op cleanup function in case of error
        return () => {};
      }
    };
    
    // Setup the subscription and store the cleanup function
    let cleanupFn: (() => void) | undefined;
    
    // Start the setup process
    setupSubscriptionListener().then(cleanup => {
      cleanupFn = cleanup;
    }).catch(err => {
      console.error('Error in subscription setup:', err);
    });
    
    // Return a cleanup function that will call the actual cleanup when available
    return () => {
      if (cleanupFn) {
        cleanupFn();
      }
    };
  }, [user, fetchSubscription, subscription]);

  return {
    subscription,
    isLoading,
    error,
    fetchSubscription,
    createCheckoutSession,
    createPortalSession,
    isSubscriptionActive,
    isOnPlan,
    formatSubscriptionEndDate,
  };
} 