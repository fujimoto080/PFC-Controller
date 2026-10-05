'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { ScanBarcode } from 'lucide-react';
import { useEverOpen } from '@/hooks/use-ever-open';
import { useScanBatch } from '@/hooks/use-scan-batch';

// カメラと確認画面は重いため、初めて開くまで読み込まない
const BatchCamera = dynamic(() =>
  import('@/components/scan/ScanCamera').then((m) => m.BatchCamera),
);
const BatchReviewDrawer = dynamic(() =>
  import('@/components/scan/BatchReviewDrawer').then(
    (m) => m.BatchReviewDrawer,
  ),
);

/** 表示中の画面。 */
type View = { kind: 'camera' } | { kind: 'review' } | null;

/**
 * 押すとカメラを開き、バーコードで商品を次々に溜める。
 * 確認画面でまとめて記録（または食品リストに登録）する。溜めた商品は閉じても残り、件数をバッジで示す。
 */
export function ScanButton() {
  const batch = useScanBatch();
  const [view, setView] = useState<View>(null);
  const count = batch.items.length;
  const reviewMounted = useEverOpen(view?.kind === 'review');

  const openReview = () => {
    setView({ kind: 'review' });
  };
  const close = () => {
    setView(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setView({ kind: 'camera' });
        }}
        className="-mt-7 flex flex-col items-center"
        aria-label={
          count > 0
            ? `バーコードをスキャン（${count}品を確認待ち）`
            : 'バーコードをスキャン'
        }
      >
        <span className="bg-primary text-primary-foreground relative rounded-full p-4 shadow-lg transition-transform active:scale-95">
          <ScanBarcode size={30} />
          {count > 0 && (
            <span className="bg-destructive border-background absolute -top-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 px-1 text-xs font-bold text-white tabular-nums">
              {count}
            </span>
          )}
        </span>
        <span className="mt-1 text-[11px] font-medium">スキャン</span>
      </button>

      {view?.kind === 'camera' && (
        <BatchCamera batch={batch} onDone={openReview} onClose={close} />
      )}

      {reviewMounted && (
        <BatchReviewDrawer
          open={view?.kind === 'review'}
          batch={batch}
          onScanMore={() => {
            setView({ kind: 'camera' });
          }}
          onClose={close}
        />
      )}
    </>
  );
}
