'use client';

import dynamic from 'next/dynamic';
import { useEverOpen } from '@/hooks/use-ever-open';
import type { ScanBatch } from '@/hooks/use-scan-batch';

const BatchCamera = dynamic(() =>
  import('@/components/scan/ScanCamera').then((m) => m.BatchCamera),
);
const BatchReviewDrawer = dynamic(() =>
  import('@/components/scan/BatchReviewDrawer').then(
    (m) => m.BatchReviewDrawer,
  ),
);

export type FoodBatchView = 'camera' | 'review' | null;

/** スキャン・提案から開く共通の一括登録フロー。 */
export function FoodBatchFlow({
  batch,
  view,
  onViewChange,
  onSaved,
}: {
  batch: ScanBatch;
  view: FoodBatchView;
  onViewChange: (view: FoodBatchView) => void;
  onSaved?: () => void;
}) {
  const mounted = useEverOpen(view === 'review');
  return (
    <>
      {view === 'camera' && (
        <BatchCamera
          batch={batch}
          onDone={() => {
            onViewChange('review');
          }}
          onClose={() => {
            onViewChange(null);
          }}
        />
      )}
      {mounted && (
        <BatchReviewDrawer
          open={view === 'review'}
          batch={batch}
          onScanMore={() => {
            onViewChange('camera');
          }}
          onClose={() => {
            onViewChange(null);
          }}
          onSaved={onSaved}
        />
      )}
    </>
  );
}
