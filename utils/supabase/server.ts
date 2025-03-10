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
          try {
            // In server components, we need to use a synchronous approach
            // This is a workaround for the fact that cookies() returns a Promise
            const allCookies = document.cookie.split('; ');
            const targetCookie = allCookies.find(c => c.startsWith(`${name}=`));
            if (targetCookie) {
              return targetCookie.split('=')[1];
            }
            return undefined;
          } catch (error) {
            // If we're in a server environment where document is not available
            console.log(`Getting cookie ${name} (server-side)`);
            return undefined;
          }
        },
        set(name, value, options) {
          try {
            // This is a server-side function, so we can't set cookies directly
            console.log(`Setting cookie ${name} (server-side)`);
          } catch (error) {
            console.error(`Error setting cookie ${name}:`, error);
          }
        },
        remove(name, options) {
          try {
            // This is a server-side function, so we can't remove cookies directly
            console.log(`Removing cookie ${name} (server-side)`);
          } catch (error) {
            console.error(`Error removing cookie ${name}:`, error);
          }
        },
      },
    }
  );
}

// For compatibility with existing code that uses createClient
export const createClient = createServerSupabaseClient;
