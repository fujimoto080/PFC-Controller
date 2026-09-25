'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

const SUPPORTED_FORMATS: BarcodeFormat[] = [
  'ean_13', // JAN
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'code_93',
  'itf',
  'codabar',
  'qr_code',
];

// 誤読を避けるため、同じ値を指定回数読み取れたら確定する
const REQUIRED_SCANS = 2;
const FEEDBACK_MS = 300;

type ScanFeedback = 'success' | 'error' | null;

const FEEDBACK_CLASS = {
  success:
    'shadow-[0_0_18px_rgba(74,222,128,0.9)] ring-4 ring-green-400 ring-offset-2 ring-offset-black',
  error:
    'shadow-[0_0_18px_rgba(239,68,68,0.9)] ring-4 ring-red-500 ring-offset-2 ring-offset-black',
} as const;

function nextVideoFrame(video: HTMLVideoElement) {
  return new Promise<void>((resolve) => {
    video.requestVideoFrameCallback(() => {
      resolve();
    });
  });
}

export function BarcodeScanner({
  onScanSuccess,
  onClose,
}: BarcodeScannerProps) {
  const [feedback, setFeedback] = useState<ScanFeedback>(null);
  const [manualCode, setManualCode] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  // マウント時に一度だけ起動するため、最新のコールバックは ref 経由で参照する
  const callbacksRef = useRef({ onScanSuccess, onClose });
  useEffect(() => {
    callbacksRef.current = { onScanSuccess, onClose };
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const scanCounts = new Map<string, number>();
    // スキャン完了・失敗・アンマウントのいずれかで abort し、検出ループを止める
    const controller = new AbortController();
    const { signal } = controller;
    let stream: MediaStream | undefined;
    let feedbackTimer: number | undefined;

    const stopCamera = () => {
      stream?.getTracks().forEach((track) => {
        track.stop();
      });
    };

    const showFeedback = (status: Exclude<ScanFeedback, null>) => {
      setFeedback(status);
      window.clearTimeout(feedbackTimer);
      feedbackTimer = window.setTimeout(() => {
        setFeedback(null);
      }, FEEDBACK_MS);
    };

    const onDetected = ({ rawValue, format }: DetectedBarcode) => {
      if (!isValidBarcode(rawValue, format)) {
        showFeedback('error');
        return;
      }
      const count = (scanCounts.get(rawValue) ?? 0) + 1;
      scanCounts.set(rawValue, count);
      if (count < REQUIRED_SCANS) return;

      controller.abort();
      stopCamera();
      showFeedback('success');
      callbacksRef.current.onScanSuccess(rawValue);
    };

    const scan = async () => {
      if (typeof BarcodeDetector === 'undefined') {
        throw new Error('この端末のブラウザはバーコード検出に対応していません');
      }
      const detector = new BarcodeDetector({ formats: SUPPORTED_FORMATS });
      // 小さなバーコードも読めるよう高解像度を要求する
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      signal.throwIfAborted();
      video.srcObject = stream;
      await video.play();

      // 検出の完了を待ってから次のフレームを渡し、処理が詰まらないようにする
      for (;;) {
        const barcodes = await detector.detect(video);
        for (const barcode of barcodes) {
          signal.throwIfAborted();
          onDetected(barcode);
        }
        signal.throwIfAborted();
        await nextVideoFrame(video);
      }
    };

    scan().catch((error: unknown) => {
      // 起動完了前にアンマウントされてもカメラを確実に止める
      stopCamera();
      if (signal.aborted) return;
      controller.abort();
      toast.fromError(
        'カメラの起動に失敗しました。カメラへのアクセスを許可してください。',
        error,
      );
      callbacksRef.current.onClose();
    });

    return () => {
      controller.abort();
      window.clearTimeout(feedbackTimer);
      stopCamera();
    };
  }, []);

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
            JAN/EAN/UPC/Code128/ITFなどに対応しています
          </p>
          <div
            className={cn(
              'relative aspect-[4/3] w-full overflow-hidden rounded-md bg-black transition-shadow',
              feedback && FEEDBACK_CLASS[feedback],
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
          </div>
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
    </div>,
    document.body,
  );
}
