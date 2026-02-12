import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/Navigation";

export const metadata: Metadata = {
  title: "Pinspector - Pinterest Ideas Analyzer",
  description: "Analyze and track Pinterest Ideas for SEO and content research",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased bg-gray-50 min-h-screen font-sans">
        <Navigation />
        <main className="max-w-7xl mx-auto px-2 py-4 md:px-4 md:py-8 pb-20 md:pb-8">
          {children}
        </main>
      </body>
    </html>
  );
}
