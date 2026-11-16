'use client';

import { useEffect, useMemo, useState } from 'react';
import type { BarcodeFood } from '@/lib/barcode';
import { fetchBarcodeMappings } from '@/lib/client/api';
import { useAppState } from '@/lib/client/store';
import { foodCandidateKey } from '@/lib/food-suggestions';
import type { FoodItem } from '@/lib/types';

/** バーコードマッピングを「食品の突き合わせキー → バーコード一覧」に畳み込んで取得する。 */
export function useBarcodesByFood() {
  const { foodAliases } = useAppState();
  const [byKey, setByKey] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetchBarcodeMappings()
      .then((rows) => {
        const mappings: Record<string, string[]> = {};
        for (const { barcode, food } of rows) {
          (mappings[foodCandidateKey(food)] ??= []).push(barcode);
        }
        setByKey(mappings);
      })
      .catch((error: unknown) => {
        // 一覧表示の補助情報なので UI には出さずログのみ
        console.error('バーコードマッピングの取得に失敗しました', error);
      });
  }, []);

  const inheritedById = useMemo(() => {
    const byId = new Map<string, string[]>();
    for (const [key, alias] of Object.entries(foodAliases)) {
      byId.set(alias.foodId, [
        ...(byId.get(alias.foodId) ?? []),
        ...(byKey[key] ?? []),
      ]);
    }
    return byId;
  }, [byKey, foodAliases]);

  const registeredBarcodesOf = (food: FoodItem) => {
    const key = foodCandidateKey(food);
    const alias = foodAliases[key];
    return alias && alias.foodId !== food.id ? [] : (byKey[key] ?? []);
  };

  const barcodesOf = (food: FoodItem) => [
    ...new Set([
      ...registeredBarcodesOf(food),
      ...(inheritedById.get(food.id) ?? []),
    ]),
  ];

  const addBarcodes = (food: BarcodeFood, barcodes: string[]) => {
    const key = foodCandidateKey(food);
    setByKey((prev) => ({
      ...prev,
      [key]: Array.from(new Set([...(prev[key] ?? []), ...barcodes])),
    }));
  };

  return { barcodesOf, registeredBarcodesOf, addBarcodes };
}
