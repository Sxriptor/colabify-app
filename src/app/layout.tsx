import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/context";
import { GlobalFloatingMenu } from "@/components/ui/GlobalFloatingMenu";
import { UpdateNotification } from "@/components/ui/UpdateNotification";
import { ServiceWorkerManager } from "@/components/ServiceWorkerManager";
import { TrayNavigationListener } from "@/components/TrayNavigationListener";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Colabify - Clean GitHub Notifications",
  description: "Stay informed about your GitHub repository activity with clean, project-scoped notifications.",
  icons: {
    icon: [
      { url: '/icons/colabify.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <ServiceWorkerManager />
          {children}
          <GlobalFloatingMenu />
          <UpdateNotification />
          <TrayNavigationListener />
        </AuthProvider>
      </body>
    </html>
  );
}
