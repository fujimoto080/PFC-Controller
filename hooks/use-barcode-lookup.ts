'use client';

import { useState } from 'react';
import { fetchBarcodeFood } from '@/lib/nutrition-client';
import type { BarcodeFood } from '@/lib/barcode-mapping';

interface UseBarcodeLookupOptions {
  /** マッピングが見つかったときにフォームへ流し込む。 */
  applyFoodData: (data: BarcodeFood) => void;
  /** マッピングが未登録(404)のときにフォームを初期化する。 */
  clearForm: () => void;
}

/** バーコード↔食品マッピングの照会と、それに紐づく入力状態を管理するフック。 */
export function useBarcodeLookup({ applyFoodData, clearForm }: UseBarcodeLookupOptions) {
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [barcodeLookupInput, setBarcodeLookupInput] = useState('');
  const [mappedFoodData, setMappedFoodData] = useState<BarcodeFood | null>(null);

  /** バーコードを照会し、結果をフォームへ反映する。見つかった食品（なければ null）を返す。 */
  const runLookup = async (code: string): Promise<BarcodeFood | null> => {
    const data = await fetchBarcodeFood(code);
    if (data) {
      setMappedFoodData(data);
      applyFoodData(data);
    } else {
      setMappedFoodData(null);
      clearForm();
    }
    return data;
  };

  const clear = () => {
    setScannedBarcode(null);
    setMappedFoodData(null);
    setBarcodeLookupInput('');
  };

  return {
    scannedBarcode,
    setScannedBarcode,
    barcodeLookupInput,
    setBarcodeLookupInput,
    mappedFoodData,
    setMappedFoodData,
    runLookup,
    clear,
  };
}
