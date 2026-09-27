'use client';

import { useState } from 'react';
import { ScanBarcode } from 'lucide-react';
import { BatchReview } from '@/components/scan/BatchReview';
import { BatchCamera, PhotoCamera } from '@/components/scan/ScanCamera';
import { useScanBatch } from '@/hooks/use-scan-batch';
import { RecordDrawer } from './RecordDrawer';

/** 表示中の画面。photo は未登録の商品（id）の成分表示を撮るカメラ。 */
type View =
  | { kind: 'camera' }
  | { kind: 'review' }
  | { kind: 'photo'; id: string }
  | null;

/**
 * 押すとカメラを開き、バーコードや成分表示の写真で商品を次々に溜める。
 * 確認画面でまとめて記録（または食品リストに登録）する。溜めた商品は閉じても残り、件数をバッジで示す。
 */
export function ScanButton() {
  const batch = useScanBatch();
  const [view, setView] = useState<View>(null);
  const count = batch.items.length;

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
      {view?.kind === 'photo' && (
        <PhotoCamera
          onCapture={(dataUrl) => {
            void batch.fillFromPhoto(view.id, dataUrl);
            openReview();
          }}
          onClose={openReview}
        />
      )}

      <RecordDrawer
        open={view?.kind === 'review'}
        onClose={close}
        title={count > 0 ? `まとめて記録（${count}品）` : 'まとめて記録'}
      >
        <BatchReview
          batch={batch}
          onScanMore={() => {
            setView({ kind: 'camera' });
          }}
          onTakePhoto={(id) => {
            setView({ kind: 'photo', id });
          }}
          onDone={close}
        />
      </RecordDrawer>
    </>
  );
}
