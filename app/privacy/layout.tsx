import { Footer } from '@/app/components/landing/Footer';

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  console.log('Rendering PrivacyLayout');
  return (
    <>
      {children}
      <Footer />
    </>
  );
} 