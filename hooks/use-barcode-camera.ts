'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { isValidBarcode } from '@/lib/barcode-validation';
import { setContinuousFocus } from '@/lib/client/camera';
import { vibrate } from '@/lib/client/device';
import { toast } from '@/lib/toast';

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
// 連続読み取りで、かざしたままの同じ商品を何度も数えないための間隔
const SAME_CODE_COOLDOWN_MS = 2500;

type ScanFeedback = 'success' | 'error' | null;

/** 読み取り成功・失敗時に映像の枠を光らせるクラス。 */
export const SCAN_FEEDBACK_CLASS = {
  success:
    'shadow-[0_0_18px_rgba(74,222,128,0.9)] ring-4 ring-green-400 ring-offset-2 ring-offset-black',
  error:
    'shadow-[0_0_18px_rgba(239,68,68,0.9)] ring-4 ring-red-500 ring-offset-2 ring-offset-black',
} as const;

interface BarcodeCameraOptions {
  /** 確定したバーコード。detect が false なら呼ばれない */
  onScan?: (code: string) => void;
  /** カメラを起動できなかったとき */
  onError: () => void;
  /** true なら読み取り後もカメラを止めずに次を待つ */
  continuous?: boolean;
  /** false ならバーコード検出をせず映像だけ映す（撮影用） */
  detect?: boolean;
}

function nextVideoFrame(video: HTMLVideoElement) {
  return new Promise<void>((resolve) => {
    video.requestVideoFrameCallback(() => {
      resolve();
    });
  });
}

/**
 * 背面カメラの映像を video に映し、バーコードを検出する。
 * BarcodeDetector 非対応の端末でも映像は映し、detectorSupported=false を返す（番号入力・撮影で代替する）。
 * 映像を映し始めたら track を返す（ピント・ズーム・ライトの操作に使う）。
 * オプションはマウント時のものを使うため、切り替える場合は key で再マウントする。
 */
export function useBarcodeCamera(
  videoRef: RefObject<HTMLVideoElement | null>,
  options: BarcodeCameraOptions,
) {
  const [feedback, setFeedback] = useState<ScanFeedback>(null);
  const [detectorSupported, setDetectorSupported] = useState(true);
  const [track, setTrack] = useState<MediaStreamTrack | null>(null);
  // マウント時に一度だけ起動するため、最新のオプションは ref 経由で参照する
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const { continuous = false, detect = true } = optionsRef.current;
    const scanCounts = new Map<string, number>();
    const lastScannedAt = new Map<string, number>();
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
      const now = Date.now();
      if (now - (lastScannedAt.get(rawValue) ?? 0) < SAME_CODE_COOLDOWN_MS) {
        return;
      }
      if (!isValidBarcode(rawValue, format)) {
        showFeedback('error');
        return;
      }
      const count = (scanCounts.get(rawValue) ?? 0) + 1;
      scanCounts.set(rawValue, count);
      if (count < REQUIRED_SCANS) return;

      scanCounts.clear();
      lastScannedAt.set(rawValue, now);
      if (!continuous) {
        controller.abort();
        stopCamera();
      }
      showFeedback('success');
      vibrate(40);
      optionsRef.current.onScan?.(rawValue);
    };

    const start = async () => {
      const canDetect = detect && typeof BarcodeDetector !== 'undefined';
      if (detect && !canDetect) setDetectorSupported(false);
      // 小さなバーコードや成分表示の文字も読めるよう高解像度を要求する
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
      signal.throwIfAborted();
      const [videoTrack] = stream.getVideoTracks();
      if (videoTrack) {
        // ピントの設定に失敗しても読み取りは続ける
        await setContinuousFocus(videoTrack).catch(() => undefined);
        setTrack(videoTrack);
      }
      if (!canDetect) return;

      const detector = new BarcodeDetector({ formats: SUPPORTED_FORMATS });
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

    start().catch((error: unknown) => {
      // 起動完了前にアンマウントされてもカメラを確実に止める
      stopCamera();
      if (signal.aborted) return;
      controller.abort();
      toast.fromError(
        'カメラの起動に失敗しました。カメラへのアクセスを許可してください。',
        error,
      );
      optionsRef.current.onError();
    });

    return () => {
      controller.abort();
      window.clearTimeout(feedbackTimer);
      stopCamera();
    };
  }, [videoRef]);

  return { feedback, detectorSupported, track };
}
