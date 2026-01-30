import { Toaster } from '@/components/ui/sonner';
import { BottomNav } from '@/components/layout/BottomNav';
import './globals.css';

export const metadata = {
  title: 'PFC Balance',
  description: 'Manage your daily PFC balance',
  manifest: '/manifest.json',
};

export const viewport = {
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
      <body className="bg-background text-foreground min-h-screen pb-20 antialiased">
        <main className="container mx-auto max-w-md px-4 py-4">{children}</main>
        <BottomNav />
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
