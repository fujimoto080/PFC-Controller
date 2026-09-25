'use client';

import { useEffect, useState } from 'react';
import { buildFoodMatchKey, type BarcodeFood } from '@/lib/barcode';
import { fetchBarcodeMappings } from '@/lib/client/api';

/** バーコードマッピングを「食品の突き合わせキー → バーコード一覧」に畳み込んで取得する。 */
export function useBarcodesByFood() {
  const [byKey, setByKey] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetchBarcodeMappings()
      .then((rows) => {
        const mappings: Record<string, string[]> = {};
        for (const { barcode, food } of rows) {
          (mappings[buildFoodMatchKey(food)] ??= []).push(barcode);
        }
        setByKey(mappings);
      })
      .catch((error: unknown) => {
        // 一覧表示の補助情報なので UI には出さずログのみ
        console.error('バーコードマッピングの取得に失敗しました', error);
      });
  }, []);

  const barcodesOf = (food: BarcodeFood) =>
    byKey[buildFoodMatchKey(food)] ?? [];

  const addBarcodes = (food: BarcodeFood, barcodes: string[]) => {
    const key = buildFoodMatchKey(food);
    setByKey((prev) => ({
      ...prev,
      [key]: Array.from(new Set([...(prev[key] ?? []), ...barcodes])),
    }));
  };

  return { barcodesOf, addBarcodes };
}
