'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { loadCloudData, isCloudDataLoaded } from '@/lib/storage';

type Status = 'loading' | 'ready';

interface Props {
  children: React.ReactNode;
  isAuthenticated: boolean;
}

export function CloudDataProvider({ children, isAuthenticated }: Props) {
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>(() =>
    isAuthenticated && !isCloudDataLoaded() ? 'loading' : 'ready',
  );

  useEffect(() => {
    if (status !== 'loading') return;
    loadCloudData().finally(() => setStatus('ready'));
  }, [status]);

  if (!isAuthenticated) {
    if (pathname === '/login') return <>{children}</>;
    return <UnauthenticatedGate />;
  }

  if (status === 'loading') {
    return (
      <div className="text-muted-foreground py-10 text-center text-sm">
        データを読み込み中...
      </div>
    );
  }

  return <>{children}</>;
}

function UnauthenticatedGate() {
  return (
    <div className="space-y-4 py-10 text-center">
      <h1 className="text-xl font-semibold">ログインが必要です</h1>
      <p className="text-muted-foreground text-sm">
        食事記録を保存するには Google アカウントでログインしてください。
      </p>
      <a
        href="/login"
        className="bg-primary text-primary-foreground inline-block rounded-md px-4 py-2 text-sm"
      >
        ログイン画面へ
      </a>
    </div>
  );
}
