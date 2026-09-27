'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { CameraControls } from '@/components/scan/CameraControls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  SCAN_FEEDBACK_CLASS,
  useBarcodeCamera,
} from '@/hooks/use-barcode-camera';
import { cn } from '@/lib/utils';

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

/** バーコードを 1 件読み取って閉じるスキャナー。 */
export function BarcodeScanner({
  onScanSuccess,
  onClose,
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { feedback, detectorSupported, track } = useBarcodeCamera(videoRef, {
    onScan: onScanSuccess,
    onError: onClose,
  });

  // 親に backdrop-filter などがあると fixed の基準がずれるため body 直下に描画する
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4">
      <div className="bg-background relative w-full max-w-md overflow-hidden rounded-lg">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 z-10 bg-black/50 text-white hover:bg-black/70"
          onClick={onClose}
          aria-label="閉じる"
        >
          <X className="h-6 w-6" />
        </Button>

        <div className="p-4 text-center">
          <h3 className="mb-2 font-semibold">バーコードをスキャン</h3>
          <p className="text-muted-foreground mb-4 text-sm">
            {detectorSupported
              ? 'JAN/EAN/UPC/Code128/ITFなどに対応しています'
              : 'このブラウザはバーコード検出に対応していません。番号を入力してください'}
          </p>
          <div
            className={cn(
              'relative aspect-[4/3] w-full overflow-hidden rounded-md bg-black transition-shadow',
              feedback && SCAN_FEEDBACK_CLASS[feedback],
            )}
          >
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              muted
              playsInline
            />
            {/* 画面全体から検出するが、狙いやすいよう目安の枠を表示する */}
            <div className="pointer-events-none absolute inset-x-[10%] top-1/2 h-1/3 -translate-y-1/2 rounded-md border-2 border-white/80" />
            <CameraControls track={track} videoRef={videoRef} />
          </div>
          <ManualBarcodeForm
            className="mt-4"
            submitLabel="照会"
            onSubmit={onScanSuccess}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** カメラで読み取れないときにバーコード番号を手で入れるフォーム。 */
export function ManualBarcodeForm({
  onSubmit,
  submitLabel,
  className,
}: {
  onSubmit: (code: string) => void;
  submitLabel: string;
  className?: string;
}) {
  const [code, setCode] = useState('');
  return (
    <form
      className={cn('flex gap-2', className)}
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = code.trim();
        if (!trimmed) return;
        onSubmit(trimmed);
        setCode('');
      }}
    >
      <Input
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
        }}
        inputMode="numeric"
        placeholder="読み取れないときは番号を入力"
        aria-label="バーコード番号"
      />
      <Button type="submit" variant="secondary">
        {submitLabel}
      </Button>
    </form>
  );
}
