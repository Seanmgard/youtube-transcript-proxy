import { createServerClient } from "@supabase/ssr";
import { Database } from "@/lib/database.types";
import { getCookieOptions } from "./cookies-helper";

// Create a server-side Supabase client
export async function createServerSupabaseClient() {
  const cookieOptions = await getCookieOptions();
  
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true, // Changed to true to ensure session persistence
        flowType: 'pkce',
        // Email verification is controlled by Supabase project settings
        autoRefreshToken: true,
      },
      cookies: cookieOptions,
    }
  );
}

// For compatibility with existing code that uses createClient
export const createClient = createServerSupabaseClient;
