'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BottomNav } from '@/components/layout/BottomNav';
import { UsageTracker } from '@/components/layout/UsageTracker';
import { Button } from '@/components/ui/button';
import {
  hydrateFromCache,
  loadUserData,
  useStoreSnapshot,
  type LoadResult,
} from '@/lib/client/store';

/** ユーザーデータを使わず、読み込み完了を待たずに表示する画面。 */
const STANDALONE_PATHS = ['/login', '/oauth/authorize'];

/**
 * ページは静的に配信し、ログイン状態とユーザーデータはクライアントで解決する。
 * 前回のキャッシュで即表示しつつ、サーバーからの取得結果（未ログインなら 401）で確定させる。
 */
export function CloudDataProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const standalone = STANDALONE_PATHS.includes(pathname);
  const snapshot = useStoreSnapshot();
  const [result, setResult] = useState<LoadResult | null>(null);

  // キャッシュからの復元は paint 前に行ってローディング表示のチラつきを防ぐ
  useLayoutEffect(() => {
    hydrateFromCache();
  }, []);

  // 鮮度を保つため、ユーザーデータを使う画面に入ったら裏で再取得する
  useEffect(() => {
    if (standalone) return;
    void loadUserData().then(setResult);
  }, [standalone]);

  if (standalone) return children;

  if (result === 'unauthenticated') return <UnauthenticatedGate />;

  if (!snapshot) {
    return result === 'failed' ? (
      <div className="space-y-4 py-10 text-center">
        <p className="text-muted-foreground text-sm">
          データの読み込みに失敗しました。
        </p>
        <Button
          onClick={() => {
            window.location.reload();
          }}
        >
          再読み込み
        </Button>
      </div>
    ) : (
      <div className="text-muted-foreground py-10 text-center text-sm">
        データを読み込み中...
      </div>
    );
  }

  // 記録シートがユーザーデータを使うため、ナビも読み込み完了後に描画する
  return (
    <>
      {children}
      <BottomNav />
      <UsageTracker />
    </>
  );
}

function UnauthenticatedGate() {
  return (
    <div className="space-y-4 py-10 text-center">
      <h1 className="text-xl font-semibold">ログインが必要です</h1>
      <p className="text-muted-foreground text-sm">
        食事記録を保存するには Google アカウントでログインしてください。
      </p>
      <Link
        href="/login"
        className="bg-primary text-primary-foreground inline-block rounded-md px-4 py-2 text-sm"
      >
        ログイン画面へ
      </Link>
    </div>
  );
}
