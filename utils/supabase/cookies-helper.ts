import { cookies } from 'next/headers';

export async function getCookieOptions() {
  const cookieStore = await cookies();
  
  return {
    get(name: string) {
      return cookieStore.get(name)?.value;
    },
    set(name: string, value: string, options: any) {
      cookieStore.set({ name, value, ...options });
    },
    remove(name: string, options: any) {
      cookieStore.set({ name, value: '', ...options, maxAge: 0 });
    },
  };
} 