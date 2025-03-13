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
  BookOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { QuizCounter } from './QuizCounter';
import { useAuth } from '@/app/providers/AuthProvider';
import { createClient } from '@/utils/supabase/client';

interface SidebarProps {
  userEmail?: string;
  userName?: string;
  userAvatar?: string | null;
}

export function Sidebar({ userEmail, userName, userAvatar }: SidebarProps) {
  const pathname = usePathname();
  const { toast } = useToast();
  const { signOut, user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(userAvatar || null);
  const [isUploading, setIsUploading] = useState(false);
  const [supabase, setSupabase] = useState<any>(null);

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

    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 2MB',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsUploading(true);
      
      // For now, we'll just use a local URL
      // In a real implementation with the avatar_url column, you would:
      // 1. Upload to Supabase storage
      // 2. Get the URL
      // 3. Update the user's profile with the URL
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
    <div className="min-h-screen w-64 bg-white border-r border-gray-200 flex flex-col fixed top-0 left-0 pt-16">
      {/* Navigation */}
      <nav className="flex-1 p-4 pt-6 space-y-1">
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
    </div>
  );
} 