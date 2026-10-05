'use client';

import { RecordDrawer } from '@/components/record/RecordDrawer';
import { BatchReview } from '@/components/scan/BatchReview';
import type { ScanBatch } from '@/hooks/use-scan-batch';

interface BatchReviewDrawerProps {
  open: boolean;
  batch: ScanBatch;
  onScanMore: () => void;
  onClose: () => void;
}

/** 溜めたバーコード商品をまとめて確認・記録するシート。 */
export function BatchReviewDrawer({
  open,
  batch,
  onScanMore,
  onClose,
}: BatchReviewDrawerProps) {
  const count = batch.items.length;
  return (
    <RecordDrawer
      open={open}
      onClose={onClose}
      title={count > 0 ? `まとめて記録（${count}品）` : 'まとめて記録'}
    >
      <BatchReview batch={batch} onScanMore={onScanMore} onDone={onClose} />
    </RecordDrawer>
  );
}
