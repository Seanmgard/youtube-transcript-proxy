'use client';

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { createClient, ensureAuthenticated, refreshSession } from '@/utils/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import { Session, User } from '@supabase/supabase-js';

// Create context types
type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  signOut: async () => {},
  refreshSession: async () => {},
});

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

// Public paths that don't require authentication
const publicPaths = [
  '/',
  '/auth/sign-in',
  '/sign-in',
  '/auth/sign-up',
  '/sign-up',
  '/forgot-password',
  '/auth/callback',
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

  // Function to refresh the session
  const refreshUserSession = async () => {
    try {
      const { data, error } = await refreshSession();
      
      if (error) {
        console.error('Error refreshing session:', error);
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
      } else {
        setSession(null);
        setUser(null);
      }
    } catch (error) {
      console.error('Unexpected error refreshing session:', error);
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      // Prevent multiple redirects
      if (isRedirecting.current) return;
      isRedirecting.current = true;
      
      const supabase = createClient();
      
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      
      // Clear any problematic cookies
      document.cookie = 'sb-refresh-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      document.cookie = 'sb-auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      
      // Add a small delay before redirecting
      setTimeout(() => {
        router.push('/sign-in');
        isRedirecting.current = false;
      }, 100);
    } catch (error) {
      console.error('Error signing out:', error);
      isRedirecting.current = false;
    }
  };

  // Initialize auth state
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;
    
    const initializeAuth = async () => {
      setIsLoading(true);
      
      try {
        const supabase = createClient();
        
        // Get the initial session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          setIsLoading(false);
          return;
        }
        
        if (session) {
          console.log('Initial session found:', session.user.id);
          setSession(session);
          setUser(session.user);
          
          // If user is authenticated but on a public path (like sign-in), redirect to dashboard
          const isPublicPath = publicPaths.some(path => 
            pathname === path || pathname?.startsWith(path + '/')
          );
          
          if (isPublicPath && !isRedirecting.current && 
              (pathname === '/auth/sign-in' || pathname === '/sign-in')) {
            console.log('User is authenticated but on sign-in page, redirecting to dashboard');
            isRedirecting.current = true;
            
            // Use a more reliable redirection approach
            try {
              // First try the Next.js router
              router.push('/dashboard');
              
              // After a short delay, also try window.location for a full page navigation
              setTimeout(() => {
                if (isRedirecting.current) {
                  console.log('Fallback redirection to dashboard from initialization');
                  window.location.href = '/dashboard';
                  isRedirecting.current = false;
                }
              }, 1000);
            } catch (error) {
              console.error('Error redirecting during initialization:', error);
              isRedirecting.current = false;
            }
          }
          
          // Schedule refresh for 5 minutes before token expiry
          const expiresAt = session.expires_at;
          if (expiresAt) {
            const expiresInMs = (expiresAt - Math.floor(Date.now() / 1000)) * 1000;
            const refreshInMs = Math.max(0, expiresInMs - 5 * 60 * 1000); // 5 minutes before expiry
            
            console.log(`Scheduling token refresh in ${Math.floor(refreshInMs / 1000 / 60)} minutes`);
            refreshTimer.current = setTimeout(() => {
              refreshUserSession();
            }, refreshInMs);
          }
        } else {
          console.log('No initial session found');
        }
        
        // Set up auth state change listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event: string, newSession: any) => {
            console.log('Auth state changed:', event);
            
            // Handle token refresh events
            if (event === 'TOKEN_REFRESHED') {
              console.log('Token refreshed event received');
              // Only update the session if user IDs match or if we don't have a current session
              if (!session || (newSession && session?.user?.id === newSession?.user?.id)) {
                // Only update the session, don't trigger redirects
                if (newSession) {
                  console.log('Updating session after token refresh');
                  setSession(newSession);
                  setUser(newSession.user);
                  
                  // Schedule the next refresh
                  if (refreshTimer.current) {
                    clearTimeout(refreshTimer.current);
                  }
                  
                  const expiresAt = newSession.expires_at;
                  if (expiresAt) {
                    const expiresInMs = (expiresAt - Math.floor(Date.now() / 1000)) * 1000;
                    const refreshInMs = Math.max(0, expiresInMs - 5 * 60 * 1000); // 5 minutes before expiry
                    
                    console.log(`Scheduling next token refresh in ${Math.floor(refreshInMs / 1000 / 60)} minutes`);
                    refreshTimer.current = setTimeout(() => {
                      refreshUserSession();
                    }, refreshInMs);
                  }
                }
              }
              return;
            }
            
            if (event === 'SIGNED_IN') {
              console.log('Sign in event received');
              if (newSession) {
                setSession(newSession);
                setUser(newSession.user);
                
                // If we're on a public path, redirect to dashboard
                const isPublicPath = publicPaths.some(path => 
                  pathname === path || pathname?.startsWith(path + '/')
                );
                
                if (isPublicPath && !isRedirecting.current) {
                  console.log('Redirecting to dashboard after sign in from AuthProvider');
                  isRedirecting.current = true;
                  
                  // Use a more reliable redirection approach
                  try {
                    // First try the Next.js router
                    router.push('/dashboard');
                    
                    // After a short delay, also try window.location for a full page navigation
                    setTimeout(() => {
                      if (isRedirecting.current) {
                        console.log('Fallback redirection to dashboard from AuthProvider');
                        window.location.href = '/dashboard';
                        isRedirecting.current = false;
                      }
                    }, 1000);
                  } catch (error) {
                    console.error('Error redirecting after sign in:', error);
                    isRedirecting.current = false;
                  }
                }
              }
            } else if (event === 'SIGNED_OUT') {
              console.log('Sign out event received');
              setSession(null);
              setUser(null);
              
              // Only redirect if we're not already on a public path
              const isPublicPath = publicPaths.some(path => 
                pathname === path || pathname?.startsWith(path + '/')
              );
              
              if (!isPublicPath && !pathname?.startsWith('/auth/') && !isRedirecting.current) {
                console.log('Redirecting to sign in after sign out');
                isRedirecting.current = true;
                setTimeout(() => {
                  router.push('/sign-in');
                  isRedirecting.current = false;
                }, 100);
              }
            }
          }
        );
        
        // Return cleanup function
        return () => {
          subscription.unsubscribe();
          if (refreshTimer.current) {
            clearTimeout(refreshTimer.current);
          }
        };
      } catch (error) {
        console.error('Unexpected error initializing auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Initialize auth and store the cleanup function
    let cleanupFn: (() => void) | undefined;
    
    // Start the initialization process
    initializeAuth().then(cleanup => {
      cleanupFn = cleanup;
    }).catch(err => {
      console.error('Error in auth initialization:', err);
    });
    
    // Clean up subscription on unmount
    return () => {
      if (cleanupFn) {
        cleanupFn();
      }
    };
  }, [router, pathname]);

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

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signOut, refreshSession: refreshUserSession }}>
      {children}
    </AuthContext.Provider>
  );
} 