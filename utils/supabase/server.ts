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
        persistSession: false, // Don't persist the session on the server
        flowType: 'pkce',
        // Disable email verification by default
        emailVerificationRequired: false
      },
      cookies: cookieOptions,
    }
  );
}

// For compatibility with existing code that uses createClient
export const createClient = createServerSupabaseClient;
