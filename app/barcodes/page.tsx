'use client';

import { useEffect, useState } from 'react';
import { PfcMacroLine } from '@/components/pfc/PfcMacroLine';
import { PageTitle } from '@/components/ui/page-title';
import { StatusMessage } from '@/components/ui/status-message';
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
    <div className="space-y-4">
      <PageTitle>バーコード一覧</PageTitle>

      <div className="space-y-2 px-4">
        {mappings === 'loading' ? (
          <StatusMessage>読み込み中...</StatusMessage>
        ) : mappings === 'failed' ? (
          <StatusMessage>バーコードの取得に失敗しました</StatusMessage>
        ) : mappings.length === 0 ? (
          <StatusMessage>登録済みのバーコードはありません</StatusMessage>
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
