'use client';

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { createClient, ensureAuthenticated, refreshSession } from '@/utils/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import { Session, User, AuthChangeEvent } from '@supabase/supabase-js';

// Create context types
type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshUserSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Public paths that don't require authentication
const publicPaths = [
  '/',  // Home page is always public
  '/auth/sign-in',
  '/sign-in',
  '/auth/sign-up',
  '/sign-up',
  '/forgot-password',
  '/auth/callback',
  '/privacy',
  '/terms',
  '/contact',
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const isInitialized = useRef(false);
  const isRedirecting = useRef(false);
  const refreshTimer = useRef<NodeJS.Timeout | null>(null);
  const supabase = createClient();

  // Function to refresh the session
  const refreshUserSession = useCallback(async () => {
    try {
      const { data, error } = await refreshSession();
      
      if (error) {
        console.error('Error refreshing session:', error);
        // Clear session on refresh error
        setSession(null);
        setUser(null);
        return;
      }
      
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        
        // Schedule the next refresh for 5 minutes before token expiry
        if (refreshTimer.current) {
          clearTimeout(refreshTimer.current);
        }
        
        const expiresAt = data.session.expires_at;
        if (expiresAt) {
          const expiresInMs = (expiresAt - Math.floor(Date.now() / 1000)) * 1000;
          const refreshInMs = Math.max(0, expiresInMs - 5 * 60 * 1000); // 5 minutes before expiry
          
          refreshTimer.current = setTimeout(() => {
            refreshUserSession();
          }, refreshInMs);
        }
      }
    } catch (error) {
      console.error('Unexpected error refreshing session:', error);
      // Clear session on critical error
      setSession(null);
      setUser(null);
    }
  }, []);

  // Sign out function with enhanced error handling
  const signOut = useCallback(async () => {
    try {
      if (isRedirecting.current) return;
      isRedirecting.current = true;
      
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      // Clear the refresh timer
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }
      
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      
      // Clear all auth-related cookies
      const cookiesToClear = [
        'sb-refresh-token',
        'sb-access-token',
        'sb-auth-token'
      ];
      
      cookiesToClear.forEach(cookieName => {
        document.cookie = `${cookieName}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure; samesite=lax`;
      });
      
      // Add a small delay before redirecting
      setTimeout(() => {
        router.push('/');
        isRedirecting.current = false;
      }, 100);
    } catch (error) {
      console.error('Error signing out:', error);
      isRedirecting.current = false;
      
      // Force clear session on error
      setUser(null);
      setSession(null);
      router.push('/');
    }
  }, [router, supabase]);

  // Initialize auth state
  useEffect(() => {
    if (!supabase || isInitialized.current) return;
    
    const initializeAuth = async () => {
      setIsLoading(true);
      
      try {
        // Get the initial session
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Error getting initial session:', sessionError);
          return;
        }
        
        if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          
          // Schedule refresh
          const expiresAt = initialSession.expires_at;
          if (expiresAt) {
            const expiresInMs = (expiresAt - Math.floor(Date.now() / 1000)) * 1000;
            const refreshInMs = Math.max(0, expiresInMs - 5 * 60 * 1000);
            
            refreshTimer.current = setTimeout(() => {
              refreshUserSession();
            }, refreshInMs);
          }
        }
        
        // Set up auth state change listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event: AuthChangeEvent, newSession: Session | null) => {
            console.log('Auth state changed:', event);
            
            if (event === 'TOKEN_REFRESHED') {
              if (!session || (newSession && session?.user?.id === newSession?.user?.id)) {
                setSession(newSession);
                setUser(newSession?.user ?? null);
                
                // Schedule next refresh
                if (newSession) {
                  const expiresAt = newSession.expires_at;
                  if (expiresAt) {
                    const expiresInMs = (expiresAt - Math.floor(Date.now() / 1000)) * 1000;
                    const refreshInMs = Math.max(0, expiresInMs - 5 * 60 * 1000);
                    
                    if (refreshTimer.current) {
                      clearTimeout(refreshTimer.current);
                    }
                    
                    refreshTimer.current = setTimeout(() => {
                      refreshUserSession();
                    }, refreshInMs);
                  }
                }
              }
            } else if (event === 'SIGNED_OUT') {
              setSession(null);
              setUser(null);
              if (refreshTimer.current) {
                clearTimeout(refreshTimer.current);
                refreshTimer.current = null;
              }
            } else if (newSession) {
              setSession(newSession);
              setUser(newSession.user);
            }
          }
        );
        
        return () => {
          subscription.unsubscribe();
          if (refreshTimer.current) {
            clearTimeout(refreshTimer.current);
          }
        };
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setIsLoading(false);
        isInitialized.current = true;
      }
    };
    
    initializeAuth();
  }, [supabase, session, refreshUserSession]);

  // Redirect logic for protected routes - only run once after loading
  useEffect(() => {
    // Skip if still loading or already redirecting
    if (isLoading || isRedirecting.current) return;

    // Skip if we're on a public path
    const isPublicPath = publicPaths.some(path => 
      pathname === path || pathname?.startsWith(path + '/')
    );

    // Only redirect if not authenticated and not on a public path
    if (!user && !isPublicPath && !pathname?.startsWith('/auth/')) {
      // Try to refresh the session first
      const tryRefresh = async () => {
        const { authenticated } = await ensureAuthenticated();
        
        if (!authenticated) {
          // Prevent multiple redirects
          isRedirecting.current = true;
          
          // Add a small delay to allow other effects to complete
          setTimeout(() => {
            router.push('/sign-in');
            
            // Reset the redirecting flag after a longer delay to prevent rapid redirects
            setTimeout(() => {
              isRedirecting.current = false;
            }, 1000);
          }, 100);
        }
      };
      
      tryRefresh();
    }
  }, [user, isLoading, pathname, router]);

  // Provide the auth context
  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        signOut,
        refreshUserSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
} 