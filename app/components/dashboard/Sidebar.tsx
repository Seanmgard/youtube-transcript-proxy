'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  History, 
  Lightbulb, 
  CreditCard, 
  LogOut, 
  Upload,
  User,
  BookOpen,
  Menu,
  X,
  Zap,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { QuizCounter } from './QuizCounter';
import { useAuth } from '@/app/providers/AuthProvider';
import { useSubscription } from '@/hooks/useSubscription';
import { createClient } from '@/utils/supabase/client';

interface SidebarProps {
  userEmail?: string;
  userName?: string;
  userAvatar?: string | null;
}

// Upgrade Reminder Component
function UpgradeReminder() {
  const { isOnPlan } = useSubscription();
  
  // Don't show if user is already on premium
  if (isOnPlan('premium')) {
    return null;
  }

  return (
    <div className="mx-4 mb-4">
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-3">
        <div className="flex items-start space-x-2">
          <div className="flex-shrink-0">
            <Zap className="h-5 w-5 text-indigo-600 mt-0.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-indigo-900">
              Unlock Premium
            </p>
            <p className="text-xs text-indigo-700 mt-1 leading-relaxed">
              Just $4/month ☕ for unlimited uploads and advanced features
            </p>
            <Link href="/dashboard/subscription">
              <Button 
                size="sm" 
                className="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-7"
              >
                Upgrade Now
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ userEmail, userName, userAvatar }: SidebarProps) {
  const pathname = usePathname();
  const { toast } = useToast();
  const { signOut, user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(userAvatar || null);
  const [isUploading, setIsUploading] = useState(false);
  const [supabase, setSupabase] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const initSupabase = async () => {
      const client = await createClient();
      setSupabase(client);
    };
    
    initSupabase();
  }, []);

  // Navigation items
  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Learn', href: '/dashboard/learn', icon: BookOpen },
    { name: 'History', href: '/dashboard/history', icon: History },
    { name: 'Suggest a Feature', href: '/dashboard/suggest', icon: Lightbulb },
    { name: 'Manage Subscription', href: '/dashboard/subscription', icon: CreditCard },
  ];

  // Handle avatar upload
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!supabase || !user) {
      toast({
        title: 'Error',
        description: 'Not connected to the database or not logged in',
        variant: 'destructive',
      });
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsUploading(true);
      
      const objectUrl = URL.createObjectURL(file);
      
      // Update the avatar URL in the profiles table
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: objectUrl })
        .eq('id', user.id);
        
      if (error) {
        console.error('Error updating avatar_url:', error);
        throw new Error('Failed to update profile');
      }
      
      setAvatarUrl(objectUrl);
      
      toast({
        title: 'Avatar updated',
        description: 'Your profile picture has been updated',
      });
    } catch (error: any) {
      toast({
        title: 'Error uploading avatar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error: any) {
      toast({
        title: 'Error signing out',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      {/* Mobile Menu Toggle Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="fixed top-4 left-4 z-[60] p-2 rounded-md bg-white shadow-lg border border-gray-200 md:hidden"
        aria-label="Toggle navigation menu"
      >
        {isMobileMenuOpen ? (
          <X className="h-6 w-6 text-gray-600" />
        ) : (
          <Menu className="h-6 w-6 text-gray-600" />
        )}
      </button>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[55] md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Mobile Navigation Menu */}
          <div className="fixed top-0 left-0 w-80 h-full bg-white z-[60] md:hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center">
                <Image 
                  src="/images/logo.png" 
                  alt="QuizLab AI Logo" 
                  width={24} 
                  height={24} 
                  className="mr-2" 
                />
                <span className="text-lg font-bold text-gray-900">QuizLab AI</span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 rounded-md hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>
            
            {/* Navigation Links */}
            <div className="p-4">
              <nav className="space-y-3">
                {/* Dashboard */}
                <Link
                  href="/dashboard"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center p-3 rounded-lg transition-colors ${
                    pathname === '/dashboard' 
                      ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <LayoutDashboard className="h-5 w-5 mr-3" />
                  <span className="font-medium">Dashboard</span>
                </Link>

                {/* Learn */}
                <Link
                  href="/dashboard/learn"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center p-3 rounded-lg transition-colors ${
                    pathname === '/dashboard/learn' 
                      ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <BookOpen className="h-5 w-5 mr-3" />
                  <span className="font-medium">Learn</span>
                </Link>

                {/* History */}
                <Link
                  href="/dashboard/history"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center p-3 rounded-lg transition-colors ${
                    pathname === '/dashboard/history' 
                      ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <History className="h-5 w-5 mr-3" />
                  <span className="font-medium">History</span>
                </Link>

                {/* Suggest a Feature */}
                <Link
                  href="/dashboard/suggest"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center p-3 rounded-lg transition-colors ${
                    pathname === '/dashboard/suggest' 
                      ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <Lightbulb className="h-5 w-5 mr-3" />
                  <span className="font-medium">Suggest a Feature</span>
                </Link>

                {/* Manage Subscription */}
                <Link
                  href="/dashboard/subscription"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center p-3 rounded-lg transition-colors ${
                    pathname === '/dashboard/subscription' 
                      ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <CreditCard className="h-5 w-5 mr-3" />
                  <span className="font-medium">Manage Subscription</span>
                </Link>
              </nav>
              
              {/* Sign Out Button */}
              <div className="mt-8 pt-4 border-t border-gray-200">
                <Button 
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    handleSignOut();
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col fixed top-20 left-0 bottom-0 z-40">
        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Quiz Counter */}
        <QuizCounter />

        {/* Upgrade Reminder for Non-Premium Users */}
        <UpgradeReminder />

        {/* User Profile */}
        <div className="p-4 border-t border-gray-200 flex-shrink-0">
          <div className="flex items-center">
            <div className="relative">
              <div className="h-10 w-10 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
                {avatarUrl ? (
                  <Image 
                    src={avatarUrl} 
                    alt="User avatar" 
                    width={40} 
                    height={40} 
                    className="object-cover"
                  />
                ) : (
                  <User className="h-6 w-6 text-gray-500" />
                )}
              </div>
              <label 
                htmlFor="avatar-upload" 
                className="absolute -bottom-1 -right-1 h-5 w-5 bg-primary rounded-full flex items-center justify-center cursor-pointer"
              >
                <Upload className="h-3 w-3 text-white" />
                <input 
                  id="avatar-upload" 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleAvatarUpload}
                  disabled={isUploading}
                />
              </label>
            </div>
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-medium text-gray-900 truncate">
                {userName || 'User'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {userEmail || 'user@example.com'}
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="mt-4 w-full justify-start text-gray-700"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>
    </>
  );
} 