'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

// Navigation items for the landing page
const landingNavigation = [
  { name: 'Features', href: '/#features' },
  { name: 'Testimonials', href: '/#testimonials' },
  { name: 'Pricing', href: '/#pricing' },
  { name: 'FAQ', href: '/#faq' },
];

// Navigation items for authenticated users
interface NavigationItem {
  name: string;
  href: string;
}

const authenticatedNavigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Learn', href: '/dashboard/learn' },
  { name: 'History', href: '/dashboard/history' },
  { name: 'Suggest a Feature', href: '/dashboard/suggest' },
  { name: 'Manage Subscription', href: '/dashboard/subscription' },
];

export function MainHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [supabase, setSupabase] = useState<any>(null);
  const pathname = usePathname();
  const router = useRouter();

  // Check if user is on landing page
  const isLandingPage = pathname === '/';
  
  // Check if user is on auth pages
  const isAuthPage = pathname?.startsWith('/auth');

  useEffect(() => {
    const initSupabase = async () => {
      const client = await createClient();
      setSupabase(client);
    };
    
    initSupabase();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 10;
      if (isScrolled !== scrolled) {
        setScrolled(isScrolled);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [scrolled]);

  useEffect(() => {
    if (!supabase) return;
    
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };
    
    checkUser();
    
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event: string, session: { user: any } | null) => {
        setUser(session?.user || null);
      }
    );
    
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSignOut = async () => {
    if (!supabase) return;
    
    await supabase.auth.signOut();
    router.refresh();
    router.push('/auth/sign-in');
  };

  // Determine which navigation items to show
  const navigationItems = user ? authenticatedNavigation : landingNavigation;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-[100] transition-all duration-300 ${
        scrolled || !isLandingPage
          ? 'bg-white shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <nav className="mx-auto flex items-center justify-between p-6 lg:px-8" aria-label="Global">
        <div className="flex lg:flex-1">
          <Link href="/" className="-m-1.5 p-1.5 flex items-center">
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
        <div className="flex lg:hidden">
          <button
            type="button"
            className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-700"
            onClick={() => setMobileMenuOpen(true)}
          >
            <span className="sr-only">Open main menu</span>
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        <div className="hidden lg:flex lg:gap-x-12">
          {!isAuthPage && !user && navigationItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="text-sm font-semibold leading-6 text-gray-900 hover:text-indigo-600"
            >
              {item.name}
            </Link>
          ))}
        </div>
        <div className="hidden lg:flex lg:flex-1 lg:justify-end lg:gap-x-4">
          {loading ? (
            <div className="h-9 w-16 bg-gray-200 rounded-md animate-pulse"></div>
          ) : user ? (
            <>
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  Dashboard
                </Button>
              </Link>
              <Button 
                size="sm"
                onClick={handleSignOut}
                className="bg-gray-900 hover:bg-gray-800 text-white"
              >
                Sign Out
              </Button>
            </>
          ) : (
            <>
              {!isAuthPage && (
                <>
                  <Link href="/auth/sign-in">
                    <Button variant="outline" size="sm">
                      Sign in
                    </Button>
                  </Link>
                  <Link href="/auth/sign-up">
                    <Button size="sm">Get started</Button>
                  </Link>
                </>
              )}
            </>
          )}
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[101] bg-black/20 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          
          {/* Menu panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.2 }}
            className="fixed inset-y-0 right-0 z-[102] w-full overflow-y-auto bg-white px-6 py-6 sm:max-w-sm shadow-xl"
            style={{ height: '100dvh', maxHeight: '100dvh' }}
          >
            <div className="flex items-center justify-between">
              <Link href="/" className="-m-1.5 p-1.5 flex items-center" onClick={() => setMobileMenuOpen(false)}>
                <Image 
                  src="/images/logo.png" 
                  alt="QuizLab AI Logo" 
                  width={32} 
                  height={32} 
                  className="mr-2" 
                />
                <span className="text-xl font-bold text-gray-900">QuizLab AI</span>
              </Link>
              <button
                type="button"
                className="-m-2.5 rounded-md p-2.5 text-gray-700"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="sr-only">Close menu</span>
                <X className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
            
            {!isAuthPage && (
              <div className="space-y-2 py-6">
                {user && navigationItems.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50 border border-gray-200"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.name}
                  </Link>
                ))}
                {!user && navigationItems.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            )}
            <div className="py-6 space-y-3">
              {loading ? (
                <div className="h-9 w-full bg-gray-200 rounded-md animate-pulse"></div>
              ) : user ? (
                <>
                  <button
                    onClick={() => {
                      handleSignOut();
                      setMobileMenuOpen(false);
                    }}
                    className="-mx-3 block rounded-lg px-3 py-2.5 text-base font-semibold leading-7 text-white bg-gray-900 hover:bg-gray-800 w-full text-left"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                !isAuthPage && (
                  <>
                    <Link
                      href="/auth/sign-in"
                      className="-mx-3 block rounded-lg px-3 py-2.5 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Sign in
                    </Link>
                    <Link
                      href="/auth/sign-up"
                      className="-mx-3 block rounded-lg bg-indigo-600 px-3 py-2.5 text-base font-semibold leading-7 text-white hover:bg-indigo-500"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Get started
                    </Link>
                  </>
                )
              )}
            </div>
          </motion.div>
        </>
      )}
    </header>
  );
} 