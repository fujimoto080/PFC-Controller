'use client';

import { useEffect, useState } from 'react';
import { loadCloudData, getStoredSyncKey } from '@/lib/storage';

type Status = 'loading' | 'ready-with-key' | 'ready-without-key';

function resolveInitialStatus(): Status {
  if (typeof window === 'undefined') return 'loading';
  return getStoredSyncKey() ? 'loading' : 'ready-without-key';
}

export function CloudDataProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>(resolveInitialStatus);

  useEffect(() => {
    if (status !== 'loading') return;

    const syncKey = getStoredSyncKey();
    if (!syncKey) return;

    loadCloudData(syncKey).finally(() => setStatus('ready-with-key'));
  }, [status]);

  if (status === 'loading') {
    return (
      <div className="text-muted-foreground py-10 text-center text-sm">
        データを読み込み中...
      </div>
    );
  }

  if (status === 'ready-without-key') {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          データを保存するには「設定」画面でクラウド同期キー（8文字以上）を設定してください。同期キーを設定するまで、記録はリロードで失われます。
        </div>
        {children}
      </div>
    );
  }

  return <>{children}</>;
}
