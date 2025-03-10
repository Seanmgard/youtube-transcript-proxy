import { cookies } from 'next/headers';

// Simple synchronous cookie implementation for Supabase
export function getCookieOptions() {
  return {
    get(name: string) {
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
    set(name: string, value: string, options: any) {
      try {
        // This is a server-side function, so we can't set cookies directly
        console.log(`Setting cookie ${name} (server-side)`);
      } catch (error) {
        console.error(`Error setting cookie ${name}:`, error);
      }
    },
    remove(name: string, options: any) {
      try {
        // This is a server-side function, so we can't remove cookies directly
        console.log(`Removing cookie ${name} (server-side)`);
      } catch (error) {
        console.error(`Error removing cookie ${name}:`, error);
      }
    },
  };
}

// Helper function to get all auth-related cookies (stub for server-side)
export function getAuthCookies() {
  try {
    // Try to get cookies from browser
    if (typeof document !== 'undefined') {
      const allCookies = document.cookie.split('; ');
      const authCookies = [
        'sb-access-token',
        'sb-refresh-token',
        'sb-auth-token',
        '__supabase_session',
      ];
      
      return authCookies.reduce((acc: Record<string, string>, name) => {
        const targetCookie = allCookies.find(c => c.startsWith(`${name}=`));
        if (targetCookie) {
          acc[name] = targetCookie.split('=')[1];
        }
        return acc;
      }, {});
    }
  } catch (error) {
    console.error('Error getting auth cookies:', error);
  }
  
  // If we're in a server environment or there was an error
  return {};
}

// Helper function to set auth cookies in the browser
export function setAuthCookiesInBrowser(session: any) {
  if (typeof window === 'undefined' || !session) return;
  
  try {
    console.log('Setting auth cookies in browser...');
    
    // Use a longer expiration time for better persistence
    const maxAge = 60 * 60 * 24 * 7; // 7 days
    const domain = window.location.hostname;
    const secure = window.location.protocol === 'https:';
    
    // Set access token
    document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=${maxAge}; SameSite=Lax${secure ? '; Secure' : ''}; domain=${domain}`;
    
    // Set auth token (combined)
    document.cookie = `sb-auth-token=${session.access_token}; path=/; max-age=${maxAge}; SameSite=Lax${secure ? '; Secure' : ''}; domain=${domain}`;
    
    // Set refresh token if available
    if (session.refresh_token) {
      document.cookie = `sb-refresh-token=${session.refresh_token}; path=/; max-age=${maxAge}; SameSite=Lax${secure ? '; Secure' : ''}; domain=${domain}`;
    }
    
    // Also store in localStorage as a backup
    try {
      localStorage.setItem('sb-auth-token', session.access_token);
      if (session.refresh_token) {
        localStorage.setItem('sb-refresh-token', session.refresh_token);
      }
    } catch (e) {
      console.error('Error setting localStorage items:', e);
    }
    
    console.log('Auth cookies set in browser');
  } catch (error) {
    console.error('Error setting auth cookies in browser:', error);
  }
} 