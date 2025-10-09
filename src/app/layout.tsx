import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/context";
import { GlobalFloatingMenu } from "@/components/ui/GlobalFloatingMenu";
import { PWAInstallPrompt } from "@/components/ui/PWAInstallPrompt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DevPulse - Clean GitHub Notifications",
  description: "Stay informed about your GitHub repository activity with clean, project-scoped notifications.",
  manifest: "/manifest.json",
  themeColor: "#1f2937",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DevPulse",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "DevPulse",
    title: "DevPulse - Clean GitHub Notifications",
    description: "Stay informed about your GitHub repository activity with clean, project-scoped notifications.",
  },
  twitter: {
    card: "summary",
    title: "DevPulse - Clean GitHub Notifications",
    description: "Stay informed about your GitHub repository activity with clean, project-scoped notifications.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="DevPulse" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.svg" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          {children}
          <GlobalFloatingMenu />
          <PWAInstallPrompt />
        </AuthProvider>
      </body>
    </html>
  );
}
