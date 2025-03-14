import { GeistSans } from "geist/font";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { MainHeader } from "@/app/components/shared/MainHeader";
import { Providers } from "@/app/providers";
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

// Use the NEXT_PUBLIC_SITE_URL environment variable if available, otherwise fall back to Vercel URL or localhost
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "QuizLab AI - Transform Study Materials into Interactive Quizzes",
    template: "%s | QuizLab AI"
  },
  description: "Transform your study materials into interactive quizzes with AI. Create, customize, and share quizzes instantly. Perfect for students, teachers, and lifelong learners.",
  keywords: ["AI quiz generator", "study tools", "education technology", "learning platform", "quiz maker", "flashcards", "spaced repetition", "Anki integration"],
  authors: [{ name: "QuizLab AI" }],
  creator: "QuizLab AI",
  publisher: "QuizLab AI",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    title: "QuizLab AI - Transform Study Materials into Interactive Quizzes",
    description: "Transform your study materials into interactive quizzes with AI. Create, customize, and share quizzes instantly.",
    siteName: "QuizLab AI",
    images: [{
      url: `${siteUrl}/images/og-image.png`,
      width: 1200,
      height: 630,
      alt: "QuizLab AI - Transform Study Materials into Interactive Quizzes"
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "QuizLab AI - Transform Study Materials into Interactive Quizzes",
    description: "Transform your study materials into interactive quizzes with AI. Create, customize, and share quizzes instantly.",
    images: [`${siteUrl}/images/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={GeistSans.className}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="canonical" href={siteUrl} />
      </head>
      <body className="bg-background text-foreground overflow-x-hidden">
        <Providers>
          <MainHeader />
          <main>
            <div className="w-full">
              {children}
            </div>
          </main>
          <Toaster />
          <Analytics />
          <SpeedInsights />
        </Providers>
      </body>
    </html>
  );
}
