"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, PlusCircle, History, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

export function BottomNav() {
  const pathname = usePathname()

  const navItems = [
    { href: "/", icon: Home, label: "ホーム" },
    { href: "/log", icon: History, label: "履歴" },
    { href: "/add", icon: PlusCircle, label: "追加", main: true },
    { href: "/settings", icon: Settings, label: "設定" },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t bg-background/80 backdrop-blur-lg pb-safe">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href

          if (item.main) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center -mt-6"
              >
                <div className="bg-primary text-primary-foreground p-3 rounded-full shadow-lg hover:shadow-xl transition-all">
                  <item.icon size={28} />
                </div>
                <span className="text-xs mt-1 font-medium text-foreground">{item.label}</span>
              </Link>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full space-y-1",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon size={20} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
