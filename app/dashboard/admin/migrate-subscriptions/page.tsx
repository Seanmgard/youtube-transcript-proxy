'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function MigrateSubscriptionsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const { toast } = useToast();

  const handleMigration = async () => {
    try {
      setIsLoading(true);
      setResult(null);

      const response = await fetch('/api/admin/migrate-subscriptions');
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to migrate subscriptions');
      }

      const data = await response.json();
      
      setResult({
        success: true,
        message: data.message
      });

      toast({
        title: 'Migration Successful',
        description: data.message,
      });
    } catch (error: any) {
      console.error('Migration error:', error);
      
      setResult({
        success: false,
        message: error.message || 'An unknown error occurred'
      });

      toast({
        title: 'Migration Failed',
        description: error.message || 'Failed to migrate subscriptions',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold mb-2">Subscription Migration</h1>
        <p className="text-gray-600 mb-6">
          This tool will create free subscription records for all existing users who don't have one.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="space-y-4">
          <div className="flex flex-col space-y-2">
            <h2 className="text-xl font-semibold">Migrate User Subscriptions</h2>
            <p className="text-gray-700">
              Click the button below to create free subscription records for all existing users who don't have one.
              This is useful for migrating existing accounts to the new subscription system.
            </p>
          </div>

          {result && (
            <div className={`p-4 rounded-lg border ${
              result.success 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
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
                      ? 'text-green-800' 
                      : 'text-red-800'
                  }`}>
                    {result.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex space-x-4">
            <Button 
              onClick={handleMigration} 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Migrating...
                </>
              ) : 'Run Migration'}
            </Button>
            
            <Link href="/dashboard/subscription">
              <Button variant="outline">
                Back to Subscriptions
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 