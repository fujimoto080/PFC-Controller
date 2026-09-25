'use client';

import { useState } from 'react';
import { fetchBarcodeFood } from '@/lib/client/api';
import type { BarcodeFood } from '@/lib/barcode';
import { toast } from '@/lib/toast';

interface UseBarcodeLookupOptions {
  /** マッピングが見つかったときにフォームへ流し込む。 */
  onFound: (food: BarcodeFood) => void;
  /** マッピングが未登録のときにフォームを初期化する。 */
  onNotFound: () => void;
}

/** 照会の経路ごとの通知文言。 */
const MESSAGES = {
  scan: {
    loading: '商品情報を取得中...',
    found: (food: BarcodeFood, code: string) =>
      `「${food.name}」が見つかりました (${code})`,
    notFound: 'バーコードが見つかりませんでした。手動で入力してください。',
  },
  manual: {
    loading: 'バーコードのマッピングを確認中...',
    found: (food: BarcodeFood) =>
      `「${food.name}」のマッピングを表示しています`,
    notFound: 'このバーコードは未登録です。手動入力で登録できます。',
  },
} as const;

/** 選択中のバーコードと、それに対応する食品マッピングの照会を管理する。 */
export function useBarcodeLookup({
  onFound,
  onNotFound,
}: UseBarcodeLookupOptions) {
  const [barcode, setBarcode] = useState<string | null>(null);
  const [mappedFood, setMappedFood] = useState<BarcodeFood | null>(null);

  const lookup = async (code: string, source: keyof typeof MESSAGES) => {
    const messages = MESSAGES[source];
    setBarcode(code);
    try {
      const food = await toast.withLoading(messages.loading, () =>
        fetchBarcodeFood(code),
      );
      setMappedFood(food);
      if (food) {
        onFound(food);
        toast.success(messages.found(food, code));
      } else {
        onNotFound();
        toast.info(messages.notFound);
      }
    } catch (error) {
      toast.fromError('バーコード照会エラー', error, 'エラーが発生しました');
    }
  };

  const clear = () => {
    setBarcode(null);
    setMappedFood(null);
  };

  return { barcode, mappedFood, lookup, clear };
}
