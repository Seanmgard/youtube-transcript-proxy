import { createBrowserClient } from "@supabase/ssr";

// Create a singleton instance to ensure we don't create multiple clients
let supabaseClient: ReturnType<typeof createBrowserClient> | null = null;

export const createClient = () => {
  if (supabaseClient) {
    return supabaseClient;
  }

  const isBrowser = typeof window !== 'undefined';
  
  // In browser environments, we don't need to specify cookie methods
  // as the browser will handle cookies automatically
  supabaseClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        // Use standard browser storage for session persistence
        storage: isBrowser ? window.localStorage : undefined,
      },
      // Use default cookie handling in the browser
      cookieOptions: isBrowser ? {
        name: 'sb-auth',
        maxAge: 60 * 60 * 8, // 8 hours
        domain: window.location.hostname,
        path: '/',
        sameSite: 'lax',
        secure: window.location.protocol === 'https:',
      } : undefined,
      global: {
        headers: {
          'X-Client-Info': 'supabase-js-v2',
        },
      },
    }
  );

  return supabaseClient;
};

// Ensure user is authenticated, refreshing the session if needed
export async function ensureAuthenticated() {
  try {
    const supabase = createClient();
    
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
  } catch (error) {
    console.error('Unexpected error in ensureAuthenticated:', error);
    return { authenticated: false };
  }
}

// Refresh the session
export async function refreshSession() {
  try {
    const supabase = createClient();
    return await supabase.auth.refreshSession();
  } catch (error) {
    console.error('Error refreshing session:', error);
    return { data: { session: null, user: null }, error };
  }
}

// Function to get the current session
export const getSession = async () => {
  const supabase = createClient();
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
        const client = createClient();
        
        if (isMounted) {
          setSupabase(client);
          setLoading(false);
        }
      } catch (err) {
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
  
  // Clear localStorage
  localStorage.removeItem('sb-auth-token');
  localStorage.removeItem('supabase.auth.token');
  localStorage.removeItem('quizlab-auth-token');
  localStorage.removeItem('sb-refresh-token');
  localStorage.removeItem('sb-access-token');
  
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
    document.cookie = `${name}=; Max-Age=0; path=/; domain=${window.location.hostname}`;
    document.cookie = `${name}=; Max-Age=0; path=/;`;
  });
  
  console.log('Auth data cleared');
}
