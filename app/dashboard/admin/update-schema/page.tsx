'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function UpdateSchemaPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const { toast } = useToast();

  const handleSchemaUpdate = async () => {
    try {
      setIsLoading(true);
      setResult(null);

      const response = await fetch('/api/admin/update-profiles-schema');
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to update schema');
      }

      const data = await response.json();
      
      setResult({
        success: true,
        message: data.message
      });

      toast({
        title: 'Schema Update Successful',
        description: data.message,
      });
    } catch (error: any) {
      console.error('Schema update error:', error);
      
      setResult({
        success: false,
        message: error.message || 'An unknown error occurred'
      });

      toast({
        title: 'Schema Update Failed',
        description: error.message || 'Failed to update schema',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold mb-2">Database Schema Update</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          This tool will update the database schema to add necessary fields.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
        <div className="space-y-4">
          <div className="flex flex-col space-y-2">
            <h2 className="text-xl font-semibold">Update Profiles Schema</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Click the button below to add the <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">is_admin</code> field to the profiles table.
              This is necessary for admin functionality.
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

          <div className="flex space-x-4">
            <Button 
              onClick={handleSchemaUpdate} 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating Schema...
                </>
              ) : 'Update Schema'}
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