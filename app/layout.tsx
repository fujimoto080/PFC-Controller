import type { Metadata, Viewport } from 'next';
import { SerwistProvider } from '@serwist/turbopack/react';
import { Toaster } from '@/components/ui/sonner';
import { CloudDataProvider } from '@/components/layout/CloudDataProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'PFC Balance',
  description: 'Manage your daily PFC balance',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-background text-foreground min-h-screen pb-24 antialiased">
        <SerwistProvider
          swUrl="/serwist/sw.js"
          disable={process.env.NODE_ENV !== 'production'}
        >
          <main className="container mx-auto max-w-md px-4 py-4">
            <CloudDataProvider>{children}</CloudDataProvider>
          </main>
          <Toaster position="top-center" visibleToasts={3} />
        </SerwistProvider>
      </body>
    </html>
  );
}
