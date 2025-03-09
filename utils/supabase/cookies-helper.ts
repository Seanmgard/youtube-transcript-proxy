import { cookies } from 'next/headers';

export async function getCookieOptions() {
  const cookieStore = cookies();
  
  return {
    async get(name: string) {
      const cookieValue = await cookieStore;
      return cookieValue.get(name)?.value;
    },
    async set(name: string, value: string, options: any) {
      const cookieValue = await cookieStore;
      cookieValue.set(name, value, options);
    },
    async remove(name: string, options: any) {
      const cookieValue = await cookieStore;
      cookieValue.set(name, '', { ...options, maxAge: 0 });
    },
  };
} 