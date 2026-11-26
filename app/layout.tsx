import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Noto_Sans_Tamil,
  Noto_Sans_Devanagari,
} from "next/font/google";
import { AuthProvider } from "@/contexts/auth-context";
import { Toaster } from "@/components/ui/sonner";
import { BRAND } from "@/lib/brand";
import { LanguageProvider } from "@/contexts/language-context";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const tamilFont = Noto_Sans_Tamil({
  variable: "--font-tamil",
  subsets: ["tamil"],
});

const hindiFont = Noto_Sans_Devanagari({
  variable: "--font-hindi",
  subsets: ["devanagari"],
});

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} | ${BRAND.description}`,
    template: `%s | ${BRAND.name}`,
  },
  description: BRAND.tagline,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${geistSans.className} ${tamilFont.variable} ${hindiFont.variable}antialiased`}
      >
      <LanguageProvider>
        <AuthProvider>
          {children}
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </LanguageProvider>
      </body>
    </html>
  );
}