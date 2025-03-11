import { createServerClient } from "@supabase/ssr";
import { Database } from "@/lib/database.types";
import { getCookieOptions } from "./cookies-helper";
import { cache } from 'react';

// Cache the server-side Supabase client creation to prevent multiple instances
export const createServerSupabaseClient = cache(async () => {
  try {
    const cookieMethods = await getCookieOptions();
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new Error('Missing Supabase environment variables');
    }
    
    return createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false, // Don't persist the session on the server
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
        cookies: cookieMethods,
        cookieOptions: {
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          httpOnly: true,
        },
      }
    );
  } catch (error) {
    console.error('Error creating server Supabase client:', error);
    throw error;
  }
});

// Helper function to validate a session
export async function validateSession(accessToken?: string) {
  try {
    const supabase = await createServerSupabaseClient();
    
    if (!accessToken) {
      return { user: null, error: new Error('No access token provided') };
    }
    
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    
    if (error) {
      console.error('Error validating session:', error);
      return { user: null, error };
    }
    
    return { user, error: null };
  } catch (error) {
    console.error('Error in validateSession:', error);
    return { user: null, error };
  }
}

// Helper function to refresh a session
export async function refreshServerSession(refreshToken?: string) {
  try {
    const supabase = await createServerSupabaseClient();
    
    if (!refreshToken) {
      return { session: null, error: new Error('No refresh token provided') };
    }
    
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });
    
    if (error) {
      console.error('Error refreshing session:', error);
      return { session: null, error };
    }
    
    return { session: data.session, error: null };
  } catch (error) {
    console.error('Error in refreshServerSession:', error);
    return { session: null, error };
  }
}

// Helper function to get current session
export async function getServerSession() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error getting server session:', error);
      return { session: null, error };
    }
    
    return { session, error: null };
  } catch (error) {
    console.error('Error in getServerSession:', error);
    return { session: null, error };
  }
}

// For compatibility with existing code that uses createClient
export const createClient = createServerSupabaseClient;
