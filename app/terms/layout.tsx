import { Footer } from '@/app/components/landing/Footer';

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  console.log('Rendering TermsLayout');
  return (
    <>
      {children}
      <Footer />
    </>
  );
} 