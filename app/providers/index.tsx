'use client';

import { AuthProvider } from './AuthProvider';
import { SonnerProvider } from './SonnerProvider';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <SonnerProvider />
      {children}
    </AuthProvider>
  );
} 