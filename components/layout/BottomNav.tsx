'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Settings, Sparkles } from 'lucide-react';
import { ScanButton } from '@/components/record/ScanButton';
import { cn } from '@/lib/utils';

// 中央のスキャンボタンを挟んで左右に並べる
const LEFT_ITEMS = [
  { href: '/', icon: Home, label: '今日' },
  { href: '/suggest', icon: Sparkles, label: '提案' },
] as const;

const RIGHT_ITEMS = [
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
        {/* 左右の項目数が違ってもスキャンボタンが中央に来るよう、左右を同じ幅にする */}
        <div className="flex h-full flex-1">{LEFT_ITEMS.map(renderItem)}</div>
        <div className="flex justify-center px-4">
          <ScanButton />
        </div>
        <div className="flex h-full flex-1">{RIGHT_ITEMS.map(renderItem)}</div>
      </div>
    </nav>
  );
}
