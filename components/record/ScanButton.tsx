'use client';

import { useState } from 'react';
import { ScanBarcode } from 'lucide-react';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { fetchBarcodeFood } from '@/lib/client/api';
import { toast } from '@/lib/toast';
import { RecordDrawer, RecordStepView, type RecordStep } from './RecordDrawer';

interface ScanResult {
  barcode: string;
  timestamp: number;
  step: RecordStep;
}

const TITLES = {
  confirm: '読み取った商品',
  form: '商品の栄養を入力',
} as const;

/** 押すとすぐカメラを起動し、登録済みなら確認シート、未登録なら入力フォームを開く。 */
export function ScanButton() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  // 閉じるアニメーション中も内容を残すため、開閉は結果と別に持つ
  const [open, setOpen] = useState(false);

  const handleScanned = async (code: string) => {
    setScanning(false);
    try {
      const food = await toast.withLoading('商品情報を確認中...', () =>
        fetchBarcodeFood(code),
      );
      if (!food) toast.info('未登録の商品です。栄養を入力すると登録されます');
      setResult({
        barcode: code,
        timestamp: Date.now(),
        step: food ? { kind: 'confirm', food } : { kind: 'form' },
      });
      setOpen(true);
    } catch (error) {
      toast.fromError('バーコード照会エラー', error, 'エラーが発生しました');
    }
  };

  const close = () => {
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setScanning(true);
        }}
        className="-mt-7 flex flex-col items-center"
        aria-label="バーコードをスキャン"
      >
        <span className="bg-primary text-primary-foreground rounded-full p-4 shadow-lg transition-transform active:scale-95">
          <ScanBarcode size={30} />
        </span>
        <span className="mt-1 text-[11px] font-medium">スキャン</span>
      </button>

      {scanning && (
        <BarcodeScanner
          onScanSuccess={(code) => {
            void handleScanned(code);
          }}
          onClose={() => {
            setScanning(false);
          }}
        />
      )}

      <RecordDrawer
        open={open}
        onClose={close}
        title={result ? TITLES[result.step.kind] : ''}
      >
        {result && (
          <RecordStepView
            key={result.timestamp}
            step={result.step}
            timestamp={result.timestamp}
            barcode={result.barcode}
            onStepChange={(step) => {
              setResult({ ...result, step });
            }}
            onDone={close}
          />
        )}
      </RecordDrawer>
    </>
  );
}
