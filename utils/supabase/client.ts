import { createBrowserClient } from "@supabase/ssr";
import { AuthChangeEvent, Session } from '@supabase/supabase-js';

// Create a singleton instance to ensure we don't create multiple clients
let supabaseClient: ReturnType<typeof createBrowserClient> | null = null;

export const createClient = () => {
  // If we're not in a browser environment, return null
  if (typeof window === 'undefined') {
    return null;
  }
  
  // If we already have a client, return it
  if (supabaseClient) {
    return supabaseClient;
  }
  
  // Create a new client
  supabaseClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storage: window.localStorage,
      },
      cookieOptions: {
        name: 'sb-auth',
        maxAge: 60 * 60 * 24 * 30, // 30 days for longer persistence
        domain: window.location.hostname,
        path: '/',
        sameSite: 'lax',
        secure: window.location.protocol === 'https:',
      },
      global: {
        headers: {
          'X-Client-Info': 'supabase-js-v2',
        },
      },
    }
  );

  // Add event listeners for debugging in development
  if (process.env.NODE_ENV === 'development') {
    supabaseClient.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      console.log(`Auth state changed: ${event}`, session ? `User: ${session.user.id}` : 'No session');
      
      // Explicitly store session in localStorage for redundancy
      if (session && event === 'SIGNED_IN') {
        try {
          localStorage.setItem('sb-auth-token', session.access_token);
          localStorage.setItem('sb-auth-user', JSON.stringify(session.user));
          console.log('Explicitly stored session in localStorage');
        } catch (e) {
          console.error('Error storing session in localStorage:', e);
        }
      }
    });
  }

  return supabaseClient;
};

// Ensure user is authenticated, refreshing the session if needed
export async function ensureAuthenticated() {
  try {
    const supabase = createClient();
    if (!supabase) return { authenticated: false };
    
    // First check if we have a session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Error getting session:', sessionError);
      return { authenticated: false };
    }
    
    if (session) {
      return { authenticated: true, session };
    }
    
    // If no session, try to refresh
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError) {
      console.error('Error refreshing session:', refreshError);
      return { authenticated: false };
    }
    
    return { authenticated: !!refreshData.session, session: refreshData.session };
  } catch (error: unknown) {
    console.error('Unexpected error in ensureAuthenticated:', error);
    return { authenticated: false };
  }
}

// Refresh the session
export async function refreshSession() {
  try {
    const supabase = createClient();
    if (!supabase) return { data: { session: null, user: null }, error: new Error('No Supabase client available') };
    return await supabase.auth.refreshSession();
  } catch (error: unknown) {
    console.error('Error refreshing session:', error);
    return { data: { session: null, user: null }, error };
  }
}

// Function to get the current session
export const getSession = async () => {
  const supabase = createClient();
  if (!supabase) return { session: null, error: new Error('No Supabase client available') };
  
  const { data, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('Error getting session:', error);
    return { session: null, error };
  }
  
  return { session: data.session, error: null };
};

// Add the useSupabase hook:

import { useState, useEffect } from 'react';

/**
 * A React hook that provides access to the Supabase client.
 * This hook handles the async initialization of the client and
 * ensures it's only created once per component lifecycle.
 * 
 * @returns An object containing the Supabase client and loading state
 */
export function useSupabase() {
  const [supabase, setSupabase] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const initSupabase = async () => {
      try {
        setLoading(true);
        // Use the singleton client
        const client = createClient();
        
        if (isMounted) {
          setSupabase(client);
          setLoading(false);
        }
      } catch (err: unknown) {
        console.error('Error initializing Supabase client:', err);
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Failed to initialize Supabase client'));
          setLoading(false);
        }
      }
    };

    initSupabase();

    return () => {
      isMounted = false;
    };
  }, []);

  return { supabase, loading, error };
}

// Add a utility function to clear all auth-related cookies and local storage
export function clearAuthData() {
  if (typeof window === 'undefined') return;
  
  try {
    console.log('Clearing auth data...');
    
    // Clear localStorage
    const keysToRemove = [
      'sb-auth-token',
      'supabase.auth.token',
      'quizlab-auth-token',
      'sb-refresh-token',
      'sb-access-token',
      'sb:token',
      'supabase.auth.refreshToken',
      'supabase.auth.accessToken',
    ];
    
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e: unknown) {
        console.error(`Error removing ${key} from localStorage:`, e);
      }
    });
    
    // Clear cookies
    const cookiesToClear = [
      'sb-access-token',
      'sb-refresh-token',
      'supabase-auth-token',
      '__supabase_session',
      'sb-auth-token',
      'sb-auth',
    ];
    
    cookiesToClear.forEach(name => {
      try {
        document.cookie = `${name}=; Max-Age=0; path=/; domain=${window.location.hostname}`;
        document.cookie = `${name}=; Max-Age=0; path=/;`;
      } catch (e: unknown) {
        console.error(`Error clearing cookie ${name}:`, e);
      }
    });
    
    console.log('Auth data cleared');
    
    // If we have a Supabase client, also sign out
    if (supabaseClient) {
      console.log('Signing out from Supabase client');
      supabaseClient.auth.signOut().catch((e: unknown) => {
        console.error('Error signing out:', e);
      });
    }
  } catch (error: unknown) {
    console.error('Error clearing auth data:', error);
  }
}
