'use client';

import { RecordDrawer } from '@/components/record/RecordDrawer';
import { BatchReview } from '@/components/scan/BatchReview';
import type { ScanBatch } from '@/hooks/use-scan-batch';

interface BatchReviewDrawerProps {
  open: boolean;
  batch: ScanBatch;
  onScanMore: () => void;
  onClose: () => void;
  onSaved?: () => void;
}

/** 溜めたバーコード商品をまとめて確認・記録するシート。 */
export function BatchReviewDrawer({
  open,
  batch,
  onScanMore,
  onClose,
  onSaved,
}: BatchReviewDrawerProps) {
  const count = batch.items.length;
  return (
    <RecordDrawer
      open={open}
      onClose={onClose}
      title={
        count > 0 ? `まとめて登録・記録（${count}品）` : 'まとめて登録・記録'
      }
    >
      <BatchReview
        batch={batch}
        onScanMore={onScanMore}
        onDone={() => {
          onSaved?.();
          onClose();
        }}
      />
    </RecordDrawer>
  );
}
