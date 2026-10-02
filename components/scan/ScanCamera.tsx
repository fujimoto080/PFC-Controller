'use client';

import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  Check,
  CircleAlert,
  Keyboard,
  Loader2,
  X,
} from 'lucide-react';
import { ManualBarcodeForm } from '@/components/BarcodeScanner';
import { CameraControls } from '@/components/scan/CameraControls';
import { Button } from '@/components/ui/button';
import {
  SCAN_FEEDBACK_CLASS,
  useBarcodeCamera,
} from '@/hooks/use-barcode-camera';
import type { ScanBatch } from '@/hooks/use-scan-batch';
import type { BatchItem } from '@/lib/scan-batch';
import { cn } from '@/lib/utils';

interface BatchCameraProps {
  batch: ScanBatch;
  /** 読み取りを終えて確認画面へ進む */
  onDone: () => void;
  onClose: () => void;
}

/** カメラを開いたまま商品のバーコードを次々に読み取る。 */
export function BatchCamera({ batch, onDone, onClose }: BatchCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [lastId, setLastId] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const { feedback, detectorSupported, track } = useBarcodeCamera(videoRef, {
    continuous: true,
    onScan: (code) => {
      setLastId(batch.addBarcode(code).id);
    },
    onError: onClose,
  });
  const lastItem = batch.items.find((item) => item.id === lastId);
  const count = batch.items.length;

  return (
    <CameraShell
      title="まとめてスキャン"
      hint={
        detectorSupported
          ? 'バーコードを次々かざしてください'
          : 'このブラウザはバーコード検出に非対応です。番号を入力してください'
      }
      onClose={onClose}
    >
      <div
        className={cn(
          'relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-neutral-900 transition-shadow',
          feedback && SCAN_FEEDBACK_CLASS[feedback],
        )}
      >
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          muted
          playsInline
        />
        {/* バーコードを狙いやすいよう出す目安の枠。検出は画面全体から行う */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 h-[22%] w-4/5 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-white/80" />
        <CameraControls track={track} videoRef={videoRef} />
      </div>

      <LastScanLine item={lastItem} count={count} />
      <BatchTray items={batch.items} highlightId={lastId} />

      {manualOpen || !detectorSupported ? (
        <ManualBarcodeForm
          className="[&_input]:border-white/30 [&_input]:text-white"
          submitLabel="追加"
          onSubmit={(code) => {
            setLastId(batch.addBarcode(code).id);
          }}
        />
      ) : (
        <button
          type="button"
          className="mx-auto flex items-center gap-1.5 text-xs text-white/60"
          onClick={() => {
            setManualOpen(true);
          }}
        >
          <Keyboard className="size-3.5" /> 読み取れないときは番号を入力
        </button>
      )}

      <Button
        size="lg"
        className="h-12 w-full bg-white text-base text-black hover:bg-white/90 disabled:bg-white/20 disabled:text-white"
        disabled={count === 0}
        onClick={onDone}
      >
        {count === 0 ? 'まだ商品がありません' : `${count}品を確認`}
        {count > 0 && <ArrowRight />}
      </Button>
    </CameraShell>
  );
}

function CameraShell({
  title,
  hint,
  onClose,
  children,
}: {
  title: string;
  hint: string;
  onClose: () => void;
  children: ReactNode;
}) {
  // 親に backdrop-filter などがあると fixed の基準がずれるため body 直下に描画する
  return createPortal(
    <div className="fixed inset-0 z-50 bg-black text-white">
      <div className="mx-auto flex h-full max-w-md flex-col gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">{title}</h2>
            <p className="text-xs text-white/60">{hint}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-white hover:bg-white/10 hover:text-white"
            onClick={onClose}
            aria-label="閉じる"
          >
            <X className="size-6" />
          </Button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** 直前に読み取った商品の状態を 1 行で伝える。 */
function LastScanLine({
  item,
  count,
}: {
  item: BatchItem | undefined;
  count: number;
}) {
  let content: ReactNode = (
    <span className="text-white/50">
      {count > 0 ? `${count}品を読み取り済み` : '読み取った商品が下に並びます'}
    </span>
  );
  if (item?.status === 'loading') {
    content = (
      <>
        <Loader2 className="size-4 animate-spin" /> {item.loadingLabel}...
      </>
    );
  } else if (item?.status === 'missing') {
    content = (
      <>
        <CircleAlert className="size-4 text-amber-400" />
        未登録の商品です。確認画面で入力できます
      </>
    );
  } else if (item?.food) {
    content = (
      <>
        <Check className="size-4 text-green-400" />
        <span className="min-w-0 truncate">{item.food.name}</span>
        {item.quantity > 1 && (
          <span className="shrink-0 font-semibold">×{item.quantity}</span>
        )}
      </>
    );
  }
  return (
    <p className="flex h-5 items-center justify-center gap-1.5 text-sm">
      {content}
    </p>
  );
}

/** 溜まった商品を新しい順に横並びで見せる。 */
function BatchTray({
  items,
  highlightId,
}: {
  items: BatchItem[];
  highlightId: string | null;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
      {[...items].reverse().map((item) => (
        <li
          key={item.id}
          className={cn(
            'pointer-events-none flex max-w-[11rem] shrink-0 items-center gap-1.5 rounded-sm bg-white/5 px-2 py-1 text-xs text-white/80 select-none',
            item.id === highlightId && 'ring-1 ring-green-400',
            item.status === 'missing' && 'bg-amber-500/10 text-amber-200',
          )}
        >
          {item.status === 'loading' && (
            <Loader2 className="size-3.5 shrink-0 animate-spin" />
          )}
          {item.status === 'missing' && (
            <CircleAlert className="size-3.5 shrink-0" />
          )}
          <span className="truncate">
            {item.food?.name ??
              (item.status === 'missing' ? '未登録' : item.loadingLabel)}
          </span>
          {item.quantity !== 1 && (
            <span className="shrink-0 font-semibold">×{item.quantity}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
