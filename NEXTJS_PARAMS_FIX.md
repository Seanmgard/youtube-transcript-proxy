# Next.js Params Promise Fix

This document outlines how to fix the error related to accessing route parameters directly in Next.js App Router.

## The Error

```
Error: A param property was accessed directly with `params.quizId`. `params` is now a Promise and should be unwrapped with `React.use()`...
```

This error occurs because in newer versions of Next.js, route params are exposed as Promises, and you're trying to access `params.quizId` directly without unwrapping the Promise first.

## Solution for Client Components

If your component has the `'use client'` directive (making it a Client Component), you should use the `useParams` hook from `next/navigation` instead of accessing the params prop directly:

### Before:

```tsx
'use client';

export default function MyPage({ params }: { params: { quizId: string } }) {
  const { quizId } = params;
  
  // Rest of your component...
}
```

### After:

```tsx
'use client';

import { useParams } from 'next/navigation';

export default function MyPage() {
  const params = useParams();
  const quizId = params.quizId as string;
  
  // Rest of your component...
}
```

## Solution for Server Components

If your component is a Server Component (no `'use client'` directive), you can use the `use` hook from React to unwrap the Promise:

### Before:

```tsx
export default function MyPage({ params }: { params: { quizId: string } }) {
  const { quizId } = params;
  
  // Rest of your component...
}
```

### After:

```tsx
import { use } from 'react';

export default function MyPage({ params }: { params: { quizId: string } }) {
  const unwrappedParams = use(params);
  const quizId = unwrappedParams.quizId;
  
  // Rest of your component...
}
```

Alternatively, you can make your component async and await the params:

```tsx
export default async function MyPage({ params }: { params: { quizId: string } }) {
  const unwrappedParams = await params;
  const quizId = unwrappedParams.quizId;
  
  // Rest of your component...
}
```

## Files Updated

1. `app/dashboard/learn/[quizId]/page.tsx` - Updated to use the `useParams` hook instead of accessing params directly

## Best Practices for Next.js Route Parameters

1. **Use `useParams` in Client Components** - Always use the `useParams` hook from `next/navigation` in Client Components
2. **Use `use` or `await` in Server Components** - Use the `use` hook from React or make your component async in Server Components
3. **Type your parameters** - Use TypeScript to ensure type safety for your route parameters
4. **Handle loading states** - Consider adding loading states while parameters are being resolved
5. **Update all dynamic routes** - Make sure to update all components that use dynamic route parameters

## Additional Resources

- [Next.js Documentation on Route Parameters](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes)
- [React `use` Hook Documentation](https://react.dev/reference/react/use)
- [Next.js `useParams` Hook Documentation](https://nextjs.org/docs/app/api-reference/functions/use-params) 