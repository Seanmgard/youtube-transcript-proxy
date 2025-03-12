import { Footer } from '@/app/components/landing/Footer';

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  console.log('Rendering ContactLayout');
  return (
    <>
      {children}
      <Footer />
    </>
  );
} 