import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { AuthChangeEvent, Session } from "@supabase/supabase-js";

/**
 * A hook to handle authentication redirects consistently across the app
 * @param {Object} options - Configuration options
 * @param {string} options.protectedRoute - If true, redirects to sign-in if not authenticated
 * @param {string} options.authRoute - If true, redirects to dashboard if authenticated
 * @param {string} options.redirectTo - Where to redirect authenticated users (defaults to /dashboard)
 * @returns {Object} - Session and loading state
 */
export default function useAuthRedirect({
  protectedRoute = false,
  authRoute = false,
  redirectTo = "/dashboard"
} = {}) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    
    const checkSession = async () => {
      try {
        const supabase = createClient();
        if (!supabase) {
          if (isMounted) {
            setLoading(false);
          }
          return;
        }

        const { data } = await supabase.auth.getSession();
        
        if (isMounted) {
          setSession(data?.session || null);
        }

        // Handle redirects based on authentication state
        if (data?.session) {
          console.log("✅ User authenticated");
          if (authRoute && isMounted) {
            console.log("Redirecting to dashboard from auth route");
            router.replace(redirectTo);
          }
        } else {
          console.log("🚨 No session");
          if (protectedRoute && isMounted) {
            console.log("Redirecting to sign-in from protected route");
            router.replace(`/auth/sign-in?redirectedFrom=${encodeURIComponent(window.location.pathname)}`);
          }
        }
      } catch (error) {
        console.error("Error checking session:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkSession();

    // Set up auth state change listener
    const supabase = createClient();
    if (supabase) {
      const { data: listener } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, newSession: Session | null) => {
        if (isMounted) {
          setSession(newSession);
          
          // Handle redirects on auth state change
          if (newSession) {
            if (authRoute) {
              router.replace(redirectTo);
            }
          } else {
            if (protectedRoute) {
              router.replace(`/auth/sign-in?redirectedFrom=${encodeURIComponent(window.location.pathname)}`);
            }
          }
        }
      });

      // Clean up listener
      return () => {
        isMounted = false;
        listener.subscription.unsubscribe();
      };
    }

    return () => {
      isMounted = false;
    };
  }, [authRoute, protectedRoute, redirectTo, router]);

  return { session, loading };
} 