// Simple synchronous cookie implementation for Supabase
export function getCookieOptions() {
  return {
    get(name: string) {
      // This is a server-side function, so we can't access document.cookie
      // Instead, we'll return undefined and let Supabase handle it
      return undefined;
    },
    set(name: string, value: string, options: any) {
      // This is a server-side function, so we can't set cookies directly
      // Instead, we'll log a message and let Supabase handle it
      console.log(`Setting cookie ${name} (server-side)`);
    },
    remove(name: string, options: any) {
      // This is a server-side function, so we can't remove cookies directly
      // Instead, we'll log a message and let Supabase handle it
      console.log(`Removing cookie ${name} (server-side)`);
    },
  };
} 