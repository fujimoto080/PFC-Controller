'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Html5Qrcode,
  Html5QrcodeScannerState,
  Html5QrcodeSupportedFormats as Format,
} from 'html5-qrcode';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isValidBarcode } from '@/lib/barcode-validation';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

const REGION_ID = 'html5qr-code-full-region';

const SUPPORTED_FORMATS = [
  Format.EAN_13, // JAN
  Format.EAN_8,
  Format.UPC_A,
  Format.UPC_E,
  Format.CODE_128,
  Format.CODE_39,
  Format.CODE_93,
  Format.ITF,
  Format.CODABAR,
  Format.QR_CODE,
];

// 誤読を避けるため、同じ値を指定回数読み取れたら確定する
const REQUIRED_SCANS = 3;
const FEEDBACK_MS = 300;

type ScanFeedback = 'success' | 'error' | null;

const FEEDBACK_CLASS = {
  success:
    'shadow-[0_0_18px_rgba(74,222,128,0.9)] ring-4 ring-green-400 ring-offset-2 ring-offset-black',
  error:
    'shadow-[0_0_18px_rgba(239,68,68,0.9)] ring-4 ring-red-500 ring-offset-2 ring-offset-black',
} as const;

async function stopScanner(scanner: Html5Qrcode) {
  const state = scanner.getState();
  if (
    state === Html5QrcodeScannerState.SCANNING ||
    state === Html5QrcodeScannerState.PAUSED
  ) {
    await scanner.stop();
  }
}

export function BarcodeScanner({
  onScanSuccess,
  onClose,
}: BarcodeScannerProps) {
  const [feedback, setFeedback] = useState<ScanFeedback>(null);
  const [manualCode, setManualCode] = useState('');
  // マウント時に一度だけ起動するため、最新のコールバックは ref 経由で参照する
  const callbacksRef = useRef({ onScanSuccess, onClose });
  useEffect(() => {
    callbacksRef.current = { onScanSuccess, onClose };
  });

  useEffect(() => {
    const scanner = new Html5Qrcode(REGION_ID, {
      formatsToSupport: SUPPORTED_FORMATS,
      verbose: false,
    });
    const scanCounts = new Map<string, number>();
    let feedbackTimer: number | undefined;
    let finished = false;

    const showFeedback = (status: Exclude<ScanFeedback, null>) => {
      setFeedback(status);
      window.clearTimeout(feedbackTimer);
      feedbackTimer = window.setTimeout(() => {
        setFeedback(null);
      }, FEEDBACK_MS);
    };

    const onDecoded = (decodedText: string, format?: Format) => {
      if (finished) return;
      if (!isValidBarcode(decodedText, format)) {
        showFeedback('error');
        return;
      }
      const count = (scanCounts.get(decodedText) ?? 0) + 1;
      scanCounts.set(decodedText, count);
      if (count < REQUIRED_SCANS) return;

      finished = true;
      showFeedback('success');
      void stopScanner(scanner).catch(() => undefined);
      callbacksRef.current.onScanSuccess(decodedText);
    };

    const started = scanner
      .start(
        { facingMode: 'environment' },
        { fps: 15, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        (decodedText, result) => {
          onDecoded(decodedText, result.result.format?.format);
        },
        () => undefined,
      )
      // 読み取り精度を上げるため高解像度を要求する。未対応端末では無視する
      .then(() =>
        scanner
          .applyVideoConstraints({
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          })
          .catch(() => undefined),
      );

    started.catch((error: unknown) => {
      if (finished) return;
      toast.fromError(
        'カメラの起動に失敗しました。カメラへのアクセスを許可してください。',
        error,
      );
      callbacksRef.current.onClose();
    });

    // 起動完了前にアンマウントされてもカメラを確実に止める
    return () => {
      finished = true;
      window.clearTimeout(feedbackTimer);
      void started.then(() => stopScanner(scanner)).catch(() => undefined);
    };
  }, []);

  return (
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
            JAN/EAN/UPC/Code128/ITFなどに対応しています
          </p>
          <div
            id={REGION_ID}
            className={cn(
              'min-h-[300px] w-full overflow-hidden rounded-md bg-black transition-shadow',
              feedback && FEEDBACK_CLASS[feedback],
            )}
          />
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const code = manualCode.trim();
              if (code) onScanSuccess(code);
            }}
          >
            <Input
              value={manualCode}
              onChange={(e) => {
                setManualCode(e.target.value);
              }}
              inputMode="numeric"
              placeholder="読み取れないときは番号を入力"
              aria-label="バーコード番号"
            />
            <Button type="submit" variant="secondary">
              照会
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
