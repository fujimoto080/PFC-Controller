'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, PlusCircle, History, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', icon: Home, label: 'ホーム' },
    { href: '/log', icon: History, label: '履歴' },
    { href: '/add', icon: PlusCircle, label: '追加', main: true },
    { href: '/settings', icon: Settings, label: '設定' },
  ];

  return (
    <nav className="bg-background/80 pb-safe fixed right-0 bottom-0 left-0 border-t backdrop-blur-lg">
      <div className="flex h-16 items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          if (item.main) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="-mt-6 flex flex-col items-center justify-center"
              >
                <div className="bg-primary text-primary-foreground rounded-full p-3 shadow-lg transition-all hover:shadow-xl">
                  <item.icon size={28} />
                </div>
                <span className="text-foreground mt-1 text-xs font-medium">
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex h-full w-full flex-col items-center justify-center space-y-1',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <item.icon size={20} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
