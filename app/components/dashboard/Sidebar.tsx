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
  const [isDismissed, setIsDismissed] = useState(false);
  
  // Don't show if user is already on premium or has dismissed
  if (isOnPlan('premium') || isDismissed) {
    return null;
  }

  return (
    <div className="mx-4 mb-2">
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg p-2 relative">
        <button
          onClick={() => setIsDismissed(true)}
          className="absolute top-1 right-1 text-white/70 hover:text-white p-0.5 rounded-sm hover:bg-black/10 transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
        <div className="flex items-center space-x-2 pr-6">
          <Zap className="h-4 w-4 text-white flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white">
              Unlock Premium - $4/mo
            </p>
            <Link href="/dashboard/subscription" className="block">
              <Button 
                size="sm" 
                variant="secondary"
                className="mt-1 w-full text-xs h-6 bg-white/20 hover:bg-white/30 text-white border-none"
              >
                Upgrade
                <ArrowRight className="ml-1 h-2.5 w-2.5" />
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
  const { user } = useAuth();
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
              
              {/* Upgrade Reminder for Mobile */}
              <div className="mt-4 px-0">
                <UpgradeReminder />
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

        {/* Upgrade Reminder positioned above quiz usage */}
        <div className="p-4">
          <UpgradeReminder />
        </div>

        {/* Quiz Counter */}
        <QuizCounter />

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
        </div>
      </aside>
    </>
  );
} 