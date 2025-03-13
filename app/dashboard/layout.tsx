'use client';

import { Sidebar } from '@/app/components/dashboard/Sidebar';
import { useAuth } from '@/app/providers/AuthProvider';
import { Loader2 } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useSubscription } from '@/hooks/useSubscription';
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isLoading, signOut } = useAuth();
  const { fetchSubscription } = useSubscription();
  const [profile, setProfile] = useState<any>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasAttemptedFetch = useRef(false);
  const router = useRouter();

  // Refresh subscription data when the dashboard loads
  useEffect(() => {
    if (user && !hasAttemptedFetch.current) {
      hasAttemptedFetch.current = true;
      
      try {
        if (user.id) {
          fetchSubscription(true).catch(err => {
            console.error('Error fetching subscription:', err);
          });
        }
      } catch (err) {
        console.error('Error in subscription effect:', err);
      }
    }
  }, [user, fetchSubscription]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setIsProfileLoading(false);
        return;
      }
      
      setIsProfileLoading(true);
      setError(null);
      
      try {
        // Properly await the Supabase client
        const supabase = await createClient();
        
        // Try to select both first_name and avatar_url
        // If avatar_url doesn't exist yet, it will be null
        const { data, error } = await supabase
          .from('profiles')
          .select('first_name, avatar_url')
          .eq('id', user.id)
          .single();
          
        if (error) {
          // If there's an error about avatar_url not existing, try again with just first_name
          if (error.message.includes('avatar_url')) {
            console.warn('avatar_url column not found, fetching only first_name');
            const { data: nameData, error: nameError } = await supabase
              .from('profiles')
              .select('first_name')
              .eq('id', user.id)
              .single();
              
            if (nameError) {
              console.error('Error fetching profile:', nameError);
              setError(`Error fetching profile: ${nameError.message}`);
            } else {
              setProfile(nameData);
            }
          } else {
            console.error('Error fetching profile:', error);
            setError(`Error fetching profile: ${error.message}`);
          }
        } else {
          setProfile(data);
        }
      } catch (error: any) {
        console.error('Unexpected error fetching profile:', error);
        setError(`Unexpected error: ${error.message}`);
      } finally {
        setIsProfileLoading(false);
      }
    };
    
    if (user) {
      fetchProfile();
    } else {
      setIsProfileLoading(false);
    }
  }, [user]);

  // Use stored first name or fall back to email-based name
  const firstName = profile?.first_name || user?.email?.split('@')[0].split('.')[0] || 'User';
  // Capitalize first letter
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  if (isLoading || isProfileLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If there's an error but we have a user, we can still show the dashboard
  // with default profile information
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Fixed at the top */}
      <header className="h-16 bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50">
        <div className="flex items-center justify-between h-full px-4">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <Image 
                src="/images/logo.png" 
                alt="QuizLab AI Logo" 
                width={32} 
                height={32} 
                className="mr-2" 
              />
              <span className="text-xl font-bold text-gray-900">QuizLab AI</span>
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="text-primary hover:text-primary hover:bg-primary/10">
                Dashboard
              </Button>
            </Link>
            <Button 
              variant="default"
              size="sm"
              className="bg-primary hover:bg-primary/90"
              onClick={async () => {
                try {
                  await signOut();
                  router.push('/auth/sign-in');
                } catch (error) {
                  console.error('Error signing out:', error);
                }
              }}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <Sidebar 
        userName={displayName}
        userEmail={user?.email || ''}
        userAvatar={profile?.avatar_url}
      />
      
      {/* Main Content */}
      <main className="transition-all duration-300 md:ml-64 pt-16 min-h-screen">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mx-6 mt-6">
            <p>{error}</p>
            <p className="text-sm mt-1">You can continue using the dashboard with limited functionality.</p>
          </div>
        )}
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
} 