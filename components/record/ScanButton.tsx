'use client';

import { useState } from 'react';
import { ScanBarcode } from 'lucide-react';
import {
  FoodBatchFlow,
  type FoodBatchView,
} from '@/components/record/FoodBatchFlow';
import { useScanBatch } from '@/hooks/use-scan-batch';

/**
 * 押すとカメラを開き、バーコードで商品を次々に溜める。
 * 確認画面でまとめて記録（または食品リストに登録）する。溜めた商品は閉じても残り、件数をバッジで示す。
 */
export function ScanButton() {
  const batch = useScanBatch();
  const [view, setView] = useState<FoodBatchView>(null);
  const count = batch.items.length;
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setView('camera');
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

      <FoodBatchFlow batch={batch} view={view} onViewChange={setView} />
    </>
  );
}
