import { Toaster } from '@/components/ui/sonner';
import { BottomNav } from '@/components/layout/BottomNav';
import './globals.css';

export const metadata = {
  title: 'PFC Balance',
  description: 'Manage your daily PFC balance',
  manifest: '/manifest.json',
  themeColor: '#ffffff',
  viewport:
    'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0',
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
