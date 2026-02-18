'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Html5Qrcode,
  Html5QrcodeScannerState,
  Html5QrcodeSupportedFormats,
} from 'html5-qrcode';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13, // JAN
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.QR_CODE,
];

type ScanFeedback = 'success' | 'error' | null;
type CheckDigitResult = {
  isValid: boolean;
  actualCheckDigit: number | null;
  expectedCheckDigit: number | null;
};

function isNumeric(value: string): boolean {
  return /^[0-9]+$/.test(value);
}

function calculateMod10CheckDigit(
  digits: string,
  oddWeight: number,
  evenWeight: number,
): number | null {
  if (!isNumeric(digits)) {
    return null;
  }

  const total = digits
    .split('')
    .map((digit) => Number(digit))
    .reduce((sum, digit, index) => {
      const isOddPosition = index % 2 === 0;
      const weight = isOddPosition ? oddWeight : evenWeight;
      return sum + digit * weight;
    }, 0);

  return (10 - (total % 10)) % 10;
}

function calculateCheckDigitResult(
  value: string,
  oddWeight: number,
  evenWeight: number,
): CheckDigitResult {
  if (!isNumeric(value) || value.length < 2) {
    return {
      isValid: false,
      actualCheckDigit: null,
      expectedCheckDigit: null,
    };
  }

  const actualCheckDigit = Number(value[value.length - 1]);
  const expectedCheckDigit = calculateMod10CheckDigit(
    value.slice(0, -1),
    oddWeight,
    evenWeight,
  );

  return {
    isValid:
      expectedCheckDigit !== null && actualCheckDigit === expectedCheckDigit,
    actualCheckDigit,
    expectedCheckDigit,
  };
}

function validateEan13(value: string): boolean {
  if (value.length !== 13 || !isNumeric(value)) {
    return false;
  }
  return calculateCheckDigitResult(value, 1, 3).isValid;
}

function validateEan8(value: string): boolean {
  if (value.length !== 8 || !isNumeric(value)) {
    return false;
  }
  return calculateCheckDigitResult(value, 3, 1).isValid;
}

function validateUpcA(value: string): boolean {
  if (value.length !== 12 || !isNumeric(value)) {
    return false;
  }
  return calculateCheckDigitResult(value, 3, 1).isValid;
}

function expandUpcE(value: string): string | null {
  if (value.length !== 8 || !isNumeric(value)) {
    return null;
  }

  const numberSystem = value[0];
  const data = value.slice(1, 7);
  const checkDigit = value[7];
  const last = data[5];
  const [d1, d2, d3, d4, d5] = data;

  let manufacturer = '';
  let product = '';

  if (['0', '1', '2'].includes(last)) {
    manufacturer = `${d1}${d2}${last}00`;
    product = `00${d3}${d4}${d5}`;
  } else if (last === '3') {
    manufacturer = `${d1}${d2}${d3}00`;
    product = `000${d4}${d5}`;
  } else if (last === '4') {
    manufacturer = `${d1}${d2}${d3}${d4}0`;
    product = `0000${d5}`;
  } else {
    manufacturer = `${d1}${d2}${d3}${d4}${d5}`;
    product = `0000${last}`;
  }

  return `${numberSystem}${manufacturer}${product}${checkDigit}`;
}

function validateUpcE(value: string): boolean {
  const expanded = expandUpcE(value);
  if (!expanded) {
    return false;
  }
  return validateUpcA(expanded);
}

function validateItf(value: string): boolean {
  if (value.length < 2 || value.length % 2 !== 0 || !isNumeric(value)) {
    return false;
  }
  return calculateCheckDigitResult(value, 3, 1).isValid;
}

function getCheckDigitResult(
  value: string,
  format?: Html5QrcodeSupportedFormats,
): CheckDigitResult {
  switch (format) {
    case Html5QrcodeSupportedFormats.EAN_13:
      return calculateCheckDigitResult(value, 1, 3);
    case Html5QrcodeSupportedFormats.EAN_8:
    case Html5QrcodeSupportedFormats.UPC_A:
    case Html5QrcodeSupportedFormats.ITF:
      return calculateCheckDigitResult(value, 3, 1);
    case Html5QrcodeSupportedFormats.UPC_E: {
      const expanded = expandUpcE(value);
      if (!expanded) {
        return {
          isValid: false,
          actualCheckDigit: null,
          expectedCheckDigit: null,
        };
      }
      return calculateCheckDigitResult(expanded, 3, 1);
    }
    default:
      return {
        isValid: value.length > 0,
        actualCheckDigit: null,
        expectedCheckDigit: null,
      };
  }
}

function validateBarcode(
  value: string,
  format?: Html5QrcodeSupportedFormats,
): boolean {
  switch (format) {
    case Html5QrcodeSupportedFormats.EAN_13:
      return validateEan13(value);
    case Html5QrcodeSupportedFormats.EAN_8:
      return validateEan8(value);
    case Html5QrcodeSupportedFormats.UPC_A:
      return validateUpcA(value);
    case Html5QrcodeSupportedFormats.UPC_E:
      return validateUpcE(value);
    case Html5QrcodeSupportedFormats.ITF:
      return validateItf(value);
    case Html5QrcodeSupportedFormats.CODE_128:
    case Html5QrcodeSupportedFormats.CODE_39:
    case Html5QrcodeSupportedFormats.CODE_93:
    case Html5QrcodeSupportedFormats.CODABAR:
    case Html5QrcodeSupportedFormats.QR_CODE:
    default:
      return value.length > 0;
  }
}

export function BarcodeScanner({
  onScanSuccess,
  onClose,
}: BarcodeScannerProps) {
  const REQUIRED_CONSECUTIVE_SCANS = 3;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const regionId = 'html5qr-code-full-region';
  const [scanFeedback, setScanFeedback] = useState<ScanFeedback>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const consecutiveScanRef = useRef<{ value: string | null; count: number }>({
    value: null,
    count: 0,
  });

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (scannerRef.current) {
        try {
          const state = scannerRef.current.getState();
          if (
            state === Html5QrcodeScannerState.SCANNING ||
            state === Html5QrcodeScannerState.PAUSED
          ) {
            scannerRef.current.stop().catch(console.debug);
          }
        } catch {
          // Ignore errors during cleanup
        }
      }
      if (feedbackTimeoutRef.current !== null) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  const triggerFeedback = (status: ScanFeedback) => {
    setScanFeedback(status);
    if (feedbackTimeoutRef.current !== null) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setScanFeedback(null);
    }, 300);
  };

  const startScanning = async () => {
    try {
      const html5QrCode = new Html5Qrcode(regionId, {
        formatsToSupport: SUPPORTED_FORMATS,
        verbose: false,
      });
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' }, // Prefer back camera
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText, result) => {
          const detectedFormat = result?.result?.format?.format;
          const checkDigitResult = getCheckDigitResult(
            decodedText,
            detectedFormat,
          );
          const isValid =
            validateBarcode(decodedText, detectedFormat) &&
            checkDigitResult.isValid;

          // TODO: テスト用の可視化。正誤表示のスナックバーは将来削除予定。
          toast(
            `値: ${decodedText} / 計算チェックデジット: ${
              checkDigitResult.expectedCheckDigit ?? 'N/A'
            } / 読み取りチェックデジット: ${checkDigitResult.actualCheckDigit ?? 'N/A'}`,
            {
              description: checkDigitResult.isValid
                ? 'チェックデジットが一致しました'
                : 'チェックデジットが不一致です',
              duration: 2500,
            },
          );

          if (!isValid) {
            consecutiveScanRef.current = { value: null, count: 0 };
            triggerFeedback('error');
            return;
          }

          if (consecutiveScanRef.current.value === decodedText) {
            consecutiveScanRef.current.count += 1;
          } else {
            consecutiveScanRef.current = { value: decodedText, count: 1 };
          }

          if (consecutiveScanRef.current.count < REQUIRED_CONSECUTIVE_SCANS) {
            return;
          }

          triggerFeedback('success');
          stopScanning();
          onScanSuccess(decodedText);
        },
        () => {
          // parse error, ignore it.
        },
      );
    } catch (err) {
      console.error(err);
      toast.error(
        'カメラの起動に失敗しました。カメラへのアクセスを許可してください。',
      );
      onClose();
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (
          state === Html5QrcodeScannerState.SCANNING ||
          state === Html5QrcodeScannerState.PAUSED
        ) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        // Ignore error if scanner is not running
        console.debug('Scanner stop:', err);
      }
    }
  };

  // Auto-start on mount
  useEffect(() => {
    startScanning();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4">
      <div className="bg-background relative w-full max-w-md overflow-hidden rounded-lg">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 z-10 bg-black/50 text-white hover:bg-black/70"
          onClick={() => {
            stopScanning();
            onClose();
          }}
        >
          <X className="h-6 w-6" />
        </Button>

        <div className="p-4 text-center">
          <h3 className="mb-2 font-semibold">バーコードをスキャン</h3>
          <p className="text-muted-foreground mb-4 text-sm">
            JAN/EAN/UPC/Code128/ITFなどに対応しています
          </p>
          <div
            id={regionId}
            className={`min-h-[300px] w-full overflow-hidden rounded-md bg-black transition-shadow ${
              scanFeedback === 'success'
                ? 'shadow-[0_0_18px_rgba(74,222,128,0.9)] ring-4 ring-green-400 ring-offset-2 ring-offset-black'
                : scanFeedback === 'error'
                  ? 'shadow-[0_0_18px_rgba(239,68,68,0.9)] ring-4 ring-red-500 ring-offset-2 ring-offset-black'
                  : ''
            }`}
          />
        </div>
      </div>
    </div>
  );
}
