import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/lib/query-provider";
import { ServiceWorkerRegistrar } from "./register-sw";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zoracle",
  description: "Tap, pay, done.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Zoracle",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  width: "device-width",
  initialScale: 1,
  // Disable user-scaling on a transactional surface so accidental
  // pinch-zooms don't leave the customer staring at a half-zoomed PIN
  // pad mid-tap. We keep regular text accessible via the OS-wide
  // text-size setting — this only prevents in-page zoom gestures.
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-surface text-ink">
        <QueryProvider>{children}</QueryProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
