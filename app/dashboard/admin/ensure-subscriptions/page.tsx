'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function EnsureSubscriptionsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);
  const { toast } = useToast();

  const handleEnsureSubscriptions = async () => {
    try {
      setIsLoading(true);
      setResult(null);

      const response = await fetch('/api/admin/ensure-subscriptions');
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to ensure subscriptions');
      }

      const data = await response.json();
      
      setResult({
        success: true,
        message: data.message,
        details: data.details
      });

      toast({
        title: 'Operation Successful',
        description: data.message,
      });
    } catch (error: any) {
      console.error('Error ensuring subscriptions:', error);
      
      setResult({
        success: false,
        message: error.message || 'An unknown error occurred'
      });

      toast({
        title: 'Operation Failed',
        description: error.message || 'Failed to ensure subscriptions',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold mb-2">Ensure Subscriptions</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          This tool will ensure all users have a subscription record by creating free subscriptions for any users who don't have one.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
        <div className="space-y-4">
          <div className="flex flex-col space-y-2">
            <h2 className="text-xl font-semibold">Ensure User Subscriptions</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Click the button below to create free subscription records for all existing users who don't have one.
              This is useful for ensuring all users have a valid subscription record.
            </p>
          </div>

          {result && (
            <div className={`p-4 rounded-lg border ${
              result.success 
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}>
              <div className="flex">
                {result.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
                )}
                <div>
                  <p className={`text-sm ${
                    result.success 
                      ? 'text-green-800 dark:text-green-200' 
                      : 'text-red-800 dark:text-red-200'
                  }`}>
                    {result.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          {result && result.success && result.details && result.details.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-medium mb-2">Created Subscriptions</h3>
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto">
                <ul className="space-y-2">
                  {result.details.map((item: any, index: number) => (
                    <li key={index} className="text-sm">
                      User ID: <span className="font-mono">{item.user_id}</span> - 
                      Subscription ID: <span className="font-mono">{item.subscription_id}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="flex space-x-4">
            <Button 
              onClick={handleEnsureSubscriptions} 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : 'Ensure Subscriptions'}
            </Button>
            
            <Link href="/dashboard/admin">
              <Button variant="outline">
                Back to Admin Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 