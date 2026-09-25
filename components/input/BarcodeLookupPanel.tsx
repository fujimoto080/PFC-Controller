'use client';

import { useState } from 'react';
import { ScanBarcode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { BarcodeFood } from '@/lib/barcode';
import { toast } from '@/lib/toast';

interface BarcodeLookupPanelProps {
  barcode: string | null;
  mappedFood: BarcodeFood | null;
  onScan: () => void;
  onLookup: (code: string) => void;
  onClear: () => void;
}

/** バーコードのスキャン / 手入力での照会と、選択中バーコードのマッピング表示。 */
export function BarcodeLookupPanel({
  barcode,
  mappedFood,
  onScan,
  onLookup,
  onClear,
}: BarcodeLookupPanelProps) {
  const [input, setInput] = useState('');

  const handleLookup = () => {
    const code = input.trim();
    if (!code) {
      toast.info('確認したいバーコードを入力してください');
      return;
    }
    onLookup(code);
  };

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={onScan}
      >
        <ScanBarcode className="h-4 w-4" />
        バーコードから読み取る
      </Button>

      <div className="space-y-2 rounded-md border border-dashed p-3">
        <Label htmlFor="barcodeLookup">バーコードのマッピング確認</Label>
        <div className="flex gap-2">
          <Input
            id="barcodeLookup"
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
            }}
            placeholder="例: 4900000000000"
          />
          <Button type="button" variant="secondary" onClick={handleLookup}>
            確認
          </Button>
        </div>

        {barcode && (
          <div className="bg-muted rounded-md p-3 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-medium">現在のバーコード: {barcode}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2"
                onClick={onClear}
              >
                クリア
              </Button>
            </div>
            {mappedFood ? (
              <ul className="text-muted-foreground mt-2 space-y-1">
                <li>食品名: {mappedFood.name}</li>
                <li>
                  P/F/C: {mappedFood.protein} / {mappedFood.fat} /{' '}
                  {mappedFood.carbs} g
                </li>
                <li>カロリー: {mappedFood.calories} kcal</li>
                <li>店名: {mappedFood.store ?? '未設定'}</li>
              </ul>
            ) : (
              <p className="text-muted-foreground mt-2">
                このバーコードに対応するマッピングは未登録です。記録を追加すると登録されます。
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
