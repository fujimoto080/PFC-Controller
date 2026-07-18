'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  loadCloudData,
  isCloudDataLoaded,
  hydrateFromCache,
} from '@/lib/storage/state';

// SSR では useLayoutEffect が使えないので useEffect にフォールバック
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

type Status = 'loading' | 'ready';

interface Props {
  children: React.ReactNode;
  isAuthenticated: boolean;
  userId: string | null;
}

export function CloudDataProvider({ children, isAuthenticated, userId }: Props) {
  const pathname = usePathname();
  // SSR と CSR の初期値を揃えるため、初期値は常に 'loading'。
  // useEffect 内でキャッシュを読み込んだら同期的に 'ready' に切り替える。
  const [status, setStatus] = useState<Status>(() =>
    !isAuthenticated || isCloudDataLoaded() ? 'ready' : 'loading',
  );

  // localStorage からの hydrate は paint 前に行ってローディング画面のチラつきを防ぐ
  useIsomorphicLayoutEffect(() => {
    if (!isAuthenticated || !userId) return;
    if (isCloudDataLoaded()) {
      setStatus('ready');
      return;
    }
    if (hydrateFromCache(userId)) {
      setStatus('ready');
    }
  }, [isAuthenticated, userId]);

  // 鮮度を保つため、マウント時 / ユーザー変更時に裏で再取得する
  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    void loadCloudData(userId).finally(() => { setStatus('ready'); });
  }, [isAuthenticated, userId]);

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
