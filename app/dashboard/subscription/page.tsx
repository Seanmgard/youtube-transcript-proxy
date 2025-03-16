'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { CreditCard, Check, X, AlertCircle, Loader2, Calendar } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function SubscriptionPage() {
  const { 
    subscription, 
    isLoading, 
    error, 
    createCheckoutSession, 
    createPortalSession,
    isSubscriptionActive,
    isOnPlan,
    formatSubscriptionEndDate,
    fetchSubscription
  } = useSubscription();
  
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [authChecking, setAuthChecking] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [refreshing, setRefreshing] = useState(false);
  
  // Create refs for tracking effect execution
  const stripeRedirectEffectRan = useRef(false);
  const timestampsEffectRan = useRef(false);
  
  // Check if user is authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push('/auth/sign-in');
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setAuthChecking(false);
      }
    };
    
    checkAuth();
  }, [router]);
  
  // Handle Stripe redirect and update subscription status
  useEffect(() => {
    if (stripeRedirectEffectRan.current) return;
    stripeRedirectEffectRan.current = true;
    
    const handleStripeRedirect = async () => {
      const success = searchParams.get('success');
      const canceled = searchParams.get('canceled');
      
      if (success || canceled) {
        setRefreshing(true);
        
        try {
          // Store the checkout time for verification
          const checkoutTime = Date.now();
          
          // Initial delay to allow webhook processing
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Enhanced polling with longer duration
          const maxAttempts = 15; // 30 seconds total with 2-second intervals
          const interval = 2000;
          let lastSubscription = null;
          let lastError = null;
          
          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
              // First try to force update from Stripe
              const response = await fetch('/api/stripe/update-subscription-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ forceUpdate: true }),
              });
              
              if (!response.ok) {
                throw new Error(`Status update failed: ${response.status}`);
              }
              
              const result = await response.json();
              console.log(`Update attempt ${attempt + 1} result:`, result);
              
              // Then fetch latest data
              lastSubscription = await fetchSubscription(true);
              console.log(`Fetch attempt ${attempt + 1} subscription:`, {
                plan_type: lastSubscription?.plan_type,
                status: lastSubscription?.status,
                updated_at: lastSubscription?.updated_at,
                stripe_subscription_id: lastSubscription?.stripe_subscription_id
              });
              
              // Check if subscription is properly updated
              if (lastSubscription?.plan_type === 'premium' && 
                  lastSubscription?.status === 'active' &&
                  lastSubscription?.stripe_subscription_id) {
                
                // Verify the update is recent
                const updateTime = new Date(lastSubscription.updated_at).getTime();
                if (updateTime > checkoutTime) {
                  console.log('Subscription successfully updated to premium');
                  toast({
                    title: 'Premium Activated',
                    description: 'Your premium subscription is now active. Enjoy the full features!',
                    variant: 'default',
                  });
                  break;
                } else {
                  console.log('Found old subscription data, continuing polling');
                }
              }
              
              if (attempt < maxAttempts - 1) {
                await new Promise(resolve => setTimeout(resolve, interval));
              }
            } catch (err) {
              console.error(`Attempt ${attempt + 1} failed:`, err);
              lastError = err;
              
              if (attempt < maxAttempts - 1) {
                await new Promise(resolve => setTimeout(resolve, interval));
              }
            }
          }
          
          // If we've exhausted all attempts
          if (!lastSubscription?.stripe_subscription_id || lastSubscription?.plan_type !== 'premium') {
            console.warn('Subscription update may be delayed', { lastError, lastSubscription });
            toast({
              title: 'Subscription Processing',
              description: 'Your subscription is being processed. Please refresh the page in a few moments.',
              variant: 'default',
            });
          }
        } catch (err) {
          console.error('Error in subscription redirect effect:', err);
          toast({
            title: 'Update Check Failed',
            description: 'Unable to verify your subscription status. Please refresh the page or contact support.',
            variant: 'destructive',
          });
        } finally {
          setRefreshing(false);
          
          // Clean up URL parameters
          const url = new URL(window.location.href);
          url.searchParams.delete('success');
          url.searchParams.delete('canceled');
          window.history.replaceState({}, document.title, url.toString());
        }
        
        if (canceled) {
          toast({
            title: 'Update Canceled',
            description: 'You canceled the subscription update process.',
            variant: 'default',
          });
        }
      }
    };
    
    handleStripeRedirect();
  }, [searchParams, toast, fetchSubscription]);
  
  // Check for stored timestamps from Stripe redirects
  useEffect(() => {
    // If we've already processed the timestamps, don't run again
    if (timestampsEffectRan.current) {
      return;
    }
    
    let isMounted = true;
    // Prevent multiple polling instances
    let isPolling = false;
    // Track toast notifications to prevent spamming
    let toastShown = false;
    
    const checkStoredTimestamps = async () => {
      const checkoutTime = localStorage.getItem('subscription_checkout_time');
      const portalTime = localStorage.getItem('subscription_portal_time');
      
      if (checkoutTime || portalTime) {
        // Mark that we've run this effect
        timestampsEffectRan.current = true;
        
        // Clear the timestamps immediately
        localStorage.removeItem('subscription_checkout_time');
        localStorage.removeItem('subscription_portal_time');
        
        // Force refresh subscription data
        setRefreshing(true);
        try {
          // Wait a moment to ensure webhook has processed
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Implement polling to check for subscription updates
          let attempts = 0;
          const maxAttempts = 5; // Reduce max attempts to prevent excessive polling
          const pollInterval = 3000; // Increase interval to 3 seconds
          
          // Prevent multiple polling instances
          if (isPolling) {
            console.log('Already polling, skipping');
            return;
          }
          
          isPolling = true;
          
          const pollForSubscriptionUpdate = async () => {
            if (!isMounted) {
              isPolling = false;
              return;
            }
            
            if (attempts >= maxAttempts) {
              console.log('Max polling attempts reached, giving up');
              if (isMounted && !toastShown) {
                toast({
                  title: 'Subscription Status',
                  description: 'Your subscription status is still updating. Please refresh the page in a few moments.',
                });
                toastShown = true;
              }
              if (isMounted) {
                setRefreshing(false);
              }
              isPolling = false;
              return;
            }
            
            attempts++;
            console.log(`Polling for subscription update, attempt ${attempts}/${maxAttempts}`);
            
            try {
              // Force refresh subscription data
              if (isMounted) {
                const updatedSubscription = await fetchSubscription(true);
                
                // Check if subscription has been updated
                if (updatedSubscription && updatedSubscription.updated_at) {
                  const updateTime = new Date(updatedSubscription.updated_at).getTime();
                  const checkoutTimeNum = checkoutTime ? parseInt(checkoutTime) : 0;
                  const portalTimeNum = portalTime ? parseInt(portalTime) : 0;
                  const latestActionTime = Math.max(checkoutTimeNum, portalTimeNum);
                  
                  // If the subscription was updated after the checkout/portal action
                  if (updateTime > latestActionTime) {
                    console.log('Subscription successfully updated');
                    if (isMounted && !toastShown) {
                      toast({
                        title: 'Subscription updated',
                        description: 'Your subscription has been successfully updated.',
                      });
                      toastShown = true;
                    }
                    if (isMounted) {
                      setRefreshing(false);
                    }
                    isPolling = false;
                    return;
                  }
                }
                
                // If not yet updated, wait and try again
                if (attempts < maxAttempts && isMounted) {
                  setTimeout(pollForSubscriptionUpdate, pollInterval);
                } else {
                  isPolling = false;
                  if (isMounted) {
                    setRefreshing(false);
                  }
                }
              }
            } catch (error) {
              console.error('Error during polling:', error);
              isPolling = false;
              if (isMounted) {
                setRefreshing(false);
              }
              
              // Check if this is an auth error and redirect to login if needed
              if ((error as any).message && ((error as any).message.includes('auth') || (error as any).message.includes('unauthorized'))) {
                if (isMounted) {
                  toast({
                    title: 'Authentication Error',
                    description: 'Your session has expired. Please sign in again.',
                    variant: 'destructive',
                  });
                  router.push('/auth/sign-in');
                }
              }
            }
          };
          
          // Start polling
          pollForSubscriptionUpdate();
        } catch (error) {
          console.error('Error refreshing subscription after redirect:', error);
          if (isMounted) {
            setRefreshing(false);
          }
          isPolling = false;
          
          // Check if this is an auth error and redirect to login if needed
          if ((error as any).message && ((error as any).message.includes('auth') || (error as any).message.includes('unauthorized'))) {
            if (isMounted) {
              toast({
                title: 'Authentication Error',
                description: 'Your session has expired. Please sign in again.',
                variant: 'destructive',
              });
              router.push('/auth/sign-in');
            }
          }
        }
      }
    };
    
    checkStoredTimestamps();
    
    return () => {
      isMounted = false;
      isPolling = false;
    };
  }, [fetchSubscription, toast, router]);
  
  const handleUpgrade = async (plan: 'premium' | 'premium_annual') => {
    await createCheckoutSession(plan);
  };
  
  const handleManageSubscription = async () => {
    await createPortalSession();
  };
  
  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Perfect for students just getting started with quiz generation.',
      features: [
        '10 PDF uploads per month',
        'Up to 10 questions per quiz',
        'Basic analytics',
        'Export to doc',
        'Community support'
      ],
      limitations: [
        'Limited PDF uploads',
        'Limited questions per quiz',
        'No custom question types',
        'No flashcard learning portal'
      ],
      current: isOnPlan('free'),
      action: null
    },
    {
      name: 'Premium',
      price: billingCycle === 'monthly' ? '$8' : '$80',
      period: billingCycle === 'monthly' ? 'per month' : 'per year',
      description: 'Ideal for serious students and educators who need more capacity.',
      features: [
        'Unlimited PDF uploads',
        'Up to 30 questions per quiz',
        'Advanced analytics',
        'Export to doc and csv',
        'Priority support',
        'Custom question types',
        'Flashcard learning portal',
        'Send directly to Anki'
      ],
      limitations: [],
      current: isOnPlan('premium'),
      action: isOnPlan('premium') ? 'manage' : 'upgrade',
      savings: billingCycle === 'annual' ? 'Save 15% with annual billing' : null
    }
  ];
  
  if (authChecking || isLoading || refreshing) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-sm text-gray-500">
          {refreshing ? 'Updating your subscription...' : 'Loading...'}
        </p>
      </div>
    );
  }
  
  if (error && (error as any) !== 'Not authenticated') {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold mb-2">Manage Subscription</h1>
          <p className="text-gray-600">
            View and manage your subscription plan.
          </p>
        </div>
        
        <div className="p-6 bg-amber-50 rounded-lg border border-amber-200 mb-6">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0" />
            <div>
              <p className="text-sm text-amber-800">
                {(error as any).toString().includes('temporary') 
                  ? 'Using temporary free subscription. Your account will be updated automatically.'
                  : 'There was an issue loading your subscription information. You can still use the free features.'}
              </p>
            </div>
          </div>
        </div>
        
        {/* Still show the plans even if there's an error */}
        <div className="grid gap-6 md:grid-cols-2">
          {plans.map((plan) => (
            <div 
              key={plan.name} 
              className={`bg-white rounded-lg shadow-md p-6 border-2 ${
                plan.current 
                  ? 'border-primary' 
                  : 'border-transparent'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold">{plan.name}</h2>
                  <div className="mt-1">
                    <span className="text-2xl font-bold">{plan.price}</span>
                    <span className="text-gray-500 text-sm"> {plan.period}</span>
                  </div>
                  {plan.savings && (
                    <div className="mt-1">
                      <span className="text-green-600 text-sm font-medium">{plan.savings}</span>
                    </div>
                  )}
                </div>
                {plan.current && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    Current Plan
                  </span>
                )}
              </div>
              
              <p className="text-gray-600 mb-4">
                {plan.description}
              </p>
              
              <div className="mb-4">
                <h3 className="font-medium mb-2">Features:</h3>
                <ul className="space-y-1">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-sm text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              {plan.limitations.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-medium mb-2">Limitations:</h3>
                  <ul className="space-y-1">
                    {plan.limitations.map((limitation, index) => (
                      <li key={index} className="flex items-start">
                        <X className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
                        <span className="text-sm text-gray-600">{limitation}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {plan.name === 'Premium' && !isOnPlan('premium') && (
                <div className="mt-6">
                  <Button 
                    className="w-full" 
                    onClick={() => handleUpgrade(billingCycle === 'monthly' ? 'premium' : 'premium_annual')}
                    disabled={isLoading || refreshing}
                  >
                    {isLoading || refreshing ? 'Processing...' : `Upgrade to Premium (${billingCycle})`}
                  </Button>
                </div>
              )}
              
              {plan.name === 'Premium' && isOnPlan('premium') && (
                <div className="mt-6">
                  <Button 
                    className="w-full" 
                    onClick={handleManageSubscription}
                    disabled={isLoading || refreshing}
                    variant="outline"
                  >
                    {isLoading || refreshing ? 'Processing...' : 'Manage Subscription'}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {subscription && (subscription.stripe_subscription_id || subscription.stripe_customer_id) && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <CreditCard className="h-6 w-6 text-primary mr-2" />
              <h2 className="text-xl font-semibold">Billing Information</h2>
            </div>
            
            <div className="space-y-4">
              {subscription.stripe_subscription_id && (
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 text-gray-500 mr-2" />
                  <div>
                    <p className="text-sm text-gray-600">
                      Your subscription renews on <span className="font-medium">{formatSubscriptionEndDate()}</span>
                    </p>
                  </div>
                </div>
              )}
              
              <Button 
                variant="outline" 
                onClick={handleManageSubscription}
                disabled={isLoading || refreshing}
              >
                {isLoading || refreshing ? 'Processing...' : 'Manage Billing'}
              </Button>
            </div>
          </div>
        )}
        
        <div className="flex justify-center mt-8">
          <Button 
            variant="ghost" 
            onClick={() => {
              setRefreshing(true);
              fetchSubscription(true).finally(() => {
                setRefreshing(false);
                // Clear any URL parameters to prevent issues
                if (window.history.replaceState) {
                  window.history.replaceState({}, document.title, window.location.pathname);
                }
              });
            }}
            disabled={isLoading || refreshing}
            className="text-sm"
          >
            {isLoading || refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <span>Refresh Subscription Status</span>
            )}
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold mb-2">Manage Subscription</h1>
        <p className="text-gray-600">
          View and manage your subscription plan.
        </p>
      </div>
      
      {/* Display current subscription status */}
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center">
          <CreditCard className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-blue-800 font-medium">
              Current Plan: <span className="font-bold">{subscription?.plan_type === 'premium' ? 'Premium' : 'Free'}</span>
            </p>
            {subscription?.current_period_end && (
              <p className="text-sm text-blue-700 mt-1">
                {subscription.plan_type === 'premium' 
                  ? `Your subscription renews on ${formatSubscriptionEndDate()}`
                  : 'Upgrade to Premium for unlimited access'}
              </p>
            )}
          </div>
        </div>
      </div>
      
      {/* Billing cycle toggle */}
      <div className="flex justify-center mb-6">
        <div className="bg-white rounded-lg shadow-sm p-3 inline-flex items-center space-x-4">
          <span className={`text-sm ${billingCycle === 'monthly' ? 'font-medium text-primary' : 'text-gray-500'}`}>
            Monthly
          </span>
          <Switch
            checked={billingCycle === 'annual'}
            onCheckedChange={(checked) => setBillingCycle(checked ? 'annual' : 'monthly')}
          />
          <span className={`text-sm ${billingCycle === 'annual' ? 'font-medium text-primary' : 'text-gray-500'}`}>
            Annual
          </span>
          {billingCycle === 'annual' && (
            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
              Save 15%
            </span>
          )}
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        {plans.map((plan) => (
          <div 
            key={plan.name} 
            className={`bg-white rounded-lg shadow-md p-6 border-2 ${
              plan.current 
                ? 'border-primary' 
                : 'border-transparent'
            }`}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold">{plan.name}</h2>
                <div className="mt-1">
                  <span className="text-2xl font-bold">{plan.price}</span>
                  <span className="text-gray-500 text-sm"> {plan.period}</span>
                </div>
                {plan.savings && (
                  <div className="mt-1">
                    <span className="text-green-600 text-sm font-medium">{plan.savings}</span>
                  </div>
                )}
              </div>
              {plan.current && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  Current Plan
                </span>
              )}
            </div>
            
            <p className="text-gray-600 mb-4">
              {plan.description}
            </p>
            
            <div className="mb-4">
              <h3 className="font-medium mb-2">Features:</h3>
              <ul className="space-y-1">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-sm text-gray-600">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            {plan.limitations.length > 0 && (
              <div className="mb-4">
                <h3 className="font-medium mb-2">Limitations:</h3>
                <ul className="space-y-1">
                  {plan.limitations.map((limitation, index) => (
                    <li key={index} className="flex items-start">
                      <X className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
                      <span className="text-sm text-gray-600">{limitation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {plan.name === 'Premium' && !isOnPlan('premium') && (
              <div className="mt-6">
                <Button 
                  className="w-full" 
                  onClick={() => handleUpgrade(billingCycle === 'monthly' ? 'premium' : 'premium_annual')}
                  disabled={isLoading || refreshing}
                >
                  {isLoading || refreshing ? 'Processing...' : `Upgrade to Premium (${billingCycle})`}
                </Button>
              </div>
            )}
            
            {plan.name === 'Premium' && isOnPlan('premium') && (
              <div className="mt-6">
                <Button 
                  className="w-full" 
                  onClick={handleManageSubscription}
                  disabled={isLoading || refreshing}
                  variant="outline"
                >
                  {isLoading || refreshing ? 'Processing...' : 'Manage Subscription'}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {subscription && (subscription.stripe_subscription_id || subscription.stripe_customer_id) && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center mb-4">
            <CreditCard className="h-6 w-6 text-primary mr-2" />
            <h2 className="text-xl font-semibold">Billing Information</h2>
          </div>
          
          <div className="space-y-4">
            {subscription.stripe_subscription_id && (
              <div className="flex items-center">
                <Calendar className="h-5 w-5 text-gray-500 mr-2" />
                <div>
                  <p className="text-sm text-gray-600">
                    Your subscription renews on <span className="font-medium">{formatSubscriptionEndDate()}</span>
                  </p>
                </div>
              </div>
            )}
            
            <Button 
              variant="outline" 
              onClick={handleManageSubscription}
              disabled={isLoading || refreshing}
            >
              {isLoading || refreshing ? 'Processing...' : 'Manage Billing'}
            </Button>
          </div>
        </div>
      )}
      
      {/* Add a more prominent refresh notice if returning from Stripe */}
      {searchParams.get('success') === 'true' && (
        <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-amber-800 font-medium">
                Payment successful! If your subscription status hasn't updated yet:
              </p>
              <p className="text-sm text-amber-700 mt-1">
                It may take a few moments for our system to process your payment. Your subscription status will update automatically.
              </p>
            </div>
          </div>
          <div className="mt-3 flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => {
                // Clear the URL parameters
                if (window.history.replaceState) {
                  window.history.replaceState({}, document.title, window.location.pathname);
                }
              }}
              className="bg-white"
            >
              Close
            </Button>
          </div>
        </div>
      )}
      
      <div className="flex justify-center mt-8">
        <Button 
          variant="ghost" 
          onClick={() => {
            setRefreshing(true);
            fetchSubscription(true).finally(() => {
              setRefreshing(false);
              // Clear any URL parameters to prevent issues
              if (window.history.replaceState) {
                window.history.replaceState({}, document.title, window.location.pathname);
              }
            });
          }}
          disabled={isLoading || refreshing}
          className="text-sm"
        >
          {isLoading || refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <span>Refresh Subscription Status</span>
          )}
        </Button>
      </div>
    </div>
  );
} 