import { Hero } from './components/landing/Hero';
import { Features } from './components/landing/Features';
import { Testimonials } from './components/landing/Testimonials';
import { Pricing } from './components/landing/Pricing';
import { CTA } from './components/landing/CTA';
import { FAQ } from './components/landing/FAQ';
import { Footer } from './components/landing/Footer';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <Hero />
      <div className="mt-0" id="features">
        <Features />
      </div>
      <div id="testimonials">
        <Testimonials />
      </div>
      <div id="pricing">
        <Pricing />
      </div>
      <FAQ />
      <CTA />
      <Footer />
    </main>
  );
}
