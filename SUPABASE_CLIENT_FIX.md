# Supabase Client Reference Fix

This document outlines the fix for the `ReferenceError: createClient is not defined` error in the Learn page.

## The Error

```
ReferenceError: createClient is not defined
at LearnPage.useEffect.initSupabase (webpack-internal:///(app-pages-browser)/./app/dashboard/learn/page.tsx:84:36)
```

This error occurred because the `createClient` function was being referenced directly in the `initSupabase` function without being properly imported or used through the `useSupabase` hook.

## The Problem

The Learn page was trying to initialize the Supabase client twice:

1. Once through the `useSupabase` hook (correctly)
2. Again through a direct call to `createClient` in a separate `useEffect` hook (incorrectly)

This caused a reference error because the `createClient` function wasn't properly imported in the context where it was being used.

## The Solution

The solution was to remove the redundant initialization of the Supabase client and rely solely on the `useSupabase` hook. Here's what was changed:

### Before:

```typescript
// Import statements
import { useSupabase } from '@/utils/supabase/client';

export default function LearnPage() {
  // State declarations
  const [supabase, setSupabase] = useState<any>(null);
  const { supabase: hookSupabase, loading: supabaseLoading } = useSupabase();

  // Incorrect: Redundant initialization of Supabase client
  useEffect(() => {
    const initSupabase = async () => {
      const client = await createClient(); // Error: createClient is not defined
      setSupabase(client);
    };
    
    initSupabase();
  }, []);

  // Rest of the component...
}
```

### After:

```typescript
// Import statements
import { useSupabase } from '@/utils/supabase/client';

export default function LearnPage() {
  // State declarations
  const { supabase, loading: supabaseLoading } = useSupabase();

  // Removed the redundant initialization

  // Rest of the component...
}
```

## Best Practices for Using Supabase Client

1. **Use the `useSupabase` Hook**: Always use the `useSupabase` hook to get the Supabase client in client components. This hook handles the asynchronous initialization of the client and ensures it's only created once per component lifecycle.

2. **Check for Loading State**: Always check if the Supabase client is still loading before using it:
   ```typescript
   const { supabase, loading: supabaseLoading } = useSupabase();
   
   useEffect(() => {
     if (!supabase) return; // Don't proceed if supabase is not initialized
     
     // Use supabase client here
   }, [supabase]);
   ```

3. **Combine Loading States**: If your component has multiple loading states, combine them to ensure a consistent user experience:
   ```typescript
   const [contentLoading, setContentLoading] = useState(true);
   const { supabase, loading: supabaseLoading } = useSupabase();
   
   // Combine loading states
   const isLoading = contentLoading || supabaseLoading;
   ```

4. **Handle Errors Gracefully**: Always handle errors from Supabase operations gracefully:
   ```typescript
   try {
     const { data, error } = await supabase.from('table').select('*');
     
     if (error) {
       console.error('Error fetching data:', error);
       // Handle error appropriately
       return;
     }
     
     // Process data
   } catch (error) {
     console.error('Unexpected error:', error);
     // Handle unexpected errors
   }
   ```

5. **Clean Up Subscriptions**: Always clean up Supabase subscriptions when components unmount:
   ```typescript
   useEffect(() => {
     const subscription = supabase
       .channel('table_changes')
       .on('postgres_changes', { event: '*', schema: 'public', table: 'table' }, handleChange)
       .subscribe();
     
     return () => {
       supabase.removeChannel(subscription);
     };
   }, [supabase]);
   ```

By following these best practices, you can avoid common issues with the Supabase client and ensure your application works reliably. 