
import { Toaster } from "@/components/ui/sonner"
import { BottomNav } from "@/components/layout/BottomNav"
import "./globals.css"

export const metadata = {
  title: "PFC Balance",
  description: "Manage your daily PFC balance",
  manifest: "/manifest.json",
  themeColor: "#ffffff",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className="antialiased min-h-screen pb-20 bg-background text-foreground">
        <main className="container mx-auto px-4 py-4 max-w-md">
          {children}
        </main>
        <BottomNav />
        <Toaster />
      </body>
    </html>
  )
}
