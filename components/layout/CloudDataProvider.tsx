'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  hydrateFromCache,
  loadUserData,
  useStoreSnapshot,
} from '@/lib/client/store';

/** ユーザーデータを使わず、読み込み完了を待たずに表示する画面。 */
const STANDALONE_PATHS = ['/login', '/oauth/authorize'];

interface Props {
  children: React.ReactNode;
  userId: string | null;
}

export function CloudDataProvider({ children, userId }: Props) {
  const pathname = usePathname();
  const snapshot = useStoreSnapshot();
  const [loadFailed, setLoadFailed] = useState(false);

  // キャッシュからの復元は paint 前に行ってローディング表示のチラつきを防ぐ
  useLayoutEffect(() => {
    if (userId) hydrateFromCache(userId);
  }, [userId]);

  // 鮮度を保つため、マウント時 / ユーザー変更時に裏で再取得する
  useEffect(() => {
    if (!userId) return;
    void loadUserData(userId).then((ok) => {
      setLoadFailed(!ok);
    });
  }, [userId]);

  if (STANDALONE_PATHS.includes(pathname)) return children;

  if (!userId) return <UnauthenticatedGate />;

  if (!snapshot) {
    return loadFailed ? (
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

  return children;
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
