import { createBrowserClient } from "@supabase/ssr";

// Create a singleton instance to ensure we don't create multiple clients
let supabaseClient: ReturnType<typeof createBrowserClient> | null = null;

export const createClient = () => {
  if (supabaseClient) {
    return supabaseClient;
  }

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
        // Disable email confirmation by default
        emailVerificationRequired: false
      }
    }
  );

  return supabaseClient;
};

// Function to refresh the session
export const refreshSession = async () => {
  const supabase = createClient();
  const { data, error } = await supabase.auth.refreshSession();
  
  if (error) {
    console.error('Error refreshing session:', error);
    return { data, error };
  }
  
  return { data, error: null };
};

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

// Function to check if user is authenticated and refresh if needed
export const ensureAuthenticated = async () => {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    // Try to refresh the session
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError || !refreshData.session) {
      return { authenticated: false, user: null };
    }
    
    return { authenticated: true, user: refreshData.session.user };
  }
  
  return { authenticated: true, user: session.user };
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
        const client = await createClient();
        
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
