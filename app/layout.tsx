import { GeistSans } from "geist/font";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { MainHeader } from "@/app/components/shared/MainHeader";
import { Providers } from "@/app/providers";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "QuizLab AI",
  description: "Transform your study materials into interactive quizzes with AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={GeistSans.className}>
      <body className="bg-background text-foreground overflow-x-hidden">
        <Providers>
          <MainHeader />
          <main>
            <div className="w-full">
              {children}
            </div>
          </main>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
