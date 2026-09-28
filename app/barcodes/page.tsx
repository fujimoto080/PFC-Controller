'use client';

import { useEffect, useState } from 'react';
import { PfcMacroLine } from '@/components/pfc/PfcMacroLine';
import { PageTitle } from '@/components/ui/page-title';
import type { BarcodeMappingRow } from '@/lib/barcode';
import { fetchBarcodeMappings } from '@/lib/client/api';

type LoadState = BarcodeMappingRow[] | 'loading' | 'failed';

export default function BarcodesPage() {
  const [mappings, setMappings] = useState<LoadState>('loading');

  useEffect(() => {
    fetchBarcodeMappings()
      .then(setMappings)
      .catch((error: unknown) => {
        console.error('バーコードマッピングの取得に失敗しました', error);
        setMappings('failed');
      });
  }, []);

  return (
    <div className="space-y-6">
      <PageTitle>バーコード一覧</PageTitle>

      <div className="space-y-2 px-4">
        {mappings === 'loading' ? (
          <Message>読み込み中...</Message>
        ) : mappings === 'failed' ? (
          <Message>バーコードの取得に失敗しました</Message>
        ) : mappings.length === 0 ? (
          <Message>登録済みのバーコードはありません</Message>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">
              {mappings.length} 件
            </p>
            {mappings.map(({ barcode, food }) => (
              <div key={barcode} className="bg-card rounded-lg border p-3">
                <div className="font-medium">{food.name}</div>
                {food.store && (
                  <div className="text-muted-foreground text-xs">
                    {food.store}
                  </div>
                )}
                <PfcMacroLine food={food} />
                <div className="text-muted-foreground font-mono text-xs">
                  {barcode}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground py-6 text-center text-sm">{children}</p>
  );
}
