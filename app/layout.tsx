import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QueryProvider } from "@/lib/query-provider";
import { ServiceWorkerRegistrar } from "./register-sw";

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
    <html lang="en" className="h-full antialiased">
      <head>
        {/*
          Clash Grotesk via Fontshare (Indian Type Foundry). Not on
          Google Fonts so we can't use `next/font/google`. Preconnect +
          stylesheet keeps the FOUT short.
        */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=clash-grotesk@300,400,500,600,700&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col bg-surface text-ink">
        <QueryProvider>{children}</QueryProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
