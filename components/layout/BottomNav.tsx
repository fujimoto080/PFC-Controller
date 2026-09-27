'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Settings, Sparkles, Utensils } from 'lucide-react';
import { ScanButton } from '@/components/record/ScanButton';
import { cn } from '@/lib/utils';

// 中央のスキャンボタンを挟んで左右に 2 つずつ並べる
const LEFT_ITEMS = [
  { href: '/', icon: Home, label: '今日' },
  { href: '/suggest', icon: Sparkles, label: '提案' },
] as const;

const RIGHT_ITEMS = [
  { href: '/foods', icon: Utensils, label: '食品' },
  { href: '/settings', icon: Settings, label: '設定' },
] as const;

type NavItem = (typeof LEFT_ITEMS | typeof RIGHT_ITEMS)[number];

export function BottomNav() {
  const pathname = usePathname();
  const renderItem = (item: NavItem) => (
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
  );

  return (
    <nav className="bg-background/80 pb-safe fixed right-0 bottom-0 left-0 z-40 border-t backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-md items-center">
        {LEFT_ITEMS.map(renderItem)}
        <div className="flex flex-1 justify-center">
          <ScanButton />
        </div>
        {RIGHT_ITEMS.map(renderItem)}
      </div>
    </nav>
  );
}
