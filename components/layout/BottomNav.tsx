'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Utensils } from 'lucide-react';
import { ScanButton } from '@/components/record/ScanButton';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', icon: Home, label: '今日' },
  { href: '/foods', icon: Utensils, label: '食品' },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const [today, foods] = NAV_ITEMS.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      className={cn(
        'flex h-full flex-1 flex-col items-center justify-center gap-1',
        pathname === item.href
          ? 'text-primary'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <item.icon size={22} />
      <span className="text-[11px] font-medium">{item.label}</span>
    </Link>
  ));

  return (
    <nav className="bg-background/80 pb-safe fixed right-0 bottom-0 left-0 z-40 border-t backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-md items-center">
        {today}
        <div className="flex flex-1 justify-center">
          <ScanButton />
        </div>
        {foods}
      </div>
    </nav>
  );
}
