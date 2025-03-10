import { createServerClient } from "@supabase/ssr";
import { Database } from "@/lib/database.types";
import { cookies } from "next/headers";

// Create a server-side Supabase client
export function createServerSupabaseClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        flowType: 'pkce',
      },
      cookies: {
        get(name) {
          // This is a server-side function, so we can't access document.cookie
          // Instead, we'll return undefined and let Supabase handle it
          return undefined;
        },
        set(name, value, options) {
          // This is a server-side function, so we can't set cookies directly
          // Instead, we'll log a message and let Supabase handle it
          console.log(`Setting cookie ${name} (server-side)`);
        },
        remove(name, options) {
          // This is a server-side function, so we can't remove cookies directly
          // Instead, we'll log a message and let Supabase handle it
          console.log(`Removing cookie ${name} (server-side)`);
        },
      },
    }
  );
}

// For compatibility with existing code that uses createClient
export const createClient = createServerSupabaseClient;
