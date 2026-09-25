'use client';

import { useState } from 'react';
import { toast } from '@/lib/toast';
import {
  estimateNutrition,
  estimateNutritionFromImage,
} from '@/lib/client/api';
import type { BarcodeFood } from '@/lib/barcode';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('画像の読み込みに失敗しました'));
    };
    reader.onerror = () => {
      reject(new Error('画像の読み込みに失敗しました'));
    };
    reader.readAsDataURL(file);
  });
}

/** 実行中の AI 入力の種類。 */
type AiNutritionPending = 'text' | 'image' | null;

/** テキストからの推定、または写真（栄養成分表示・料理）の読み取りで栄養値を得る。 */
export function useAiNutrition(onEstimated: (food: BarcodeFood) => void) {
  const [text, setText] = useState('');
  const [pending, setPending] = useState<AiNutritionPending>(null);

  const run = async (
    kind: Exclude<AiNutritionPending, null>,
    request: () => Promise<BarcodeFood>,
  ) => {
    setPending(kind);
    try {
      onEstimated(await request());
      toast.success('AIでPFCとカロリーを入力しました');
    } catch (error) {
      toast.fromError('AIでの入力に失敗しました', error);
    } finally {
      setPending(null);
    }
  };

  const estimate = async () => {
    const input = text.trim();
    if (!input) {
      toast.info('食べた内容を入力してください');
      return;
    }
    await run('text', () => estimateNutrition(input));
  };

  const estimateFromImage = (file: File) =>
    run('image', async () =>
      estimateNutritionFromImage(await readFileAsDataUrl(file)),
    );

  return { text, setText, pending, estimate, estimateFromImage };
}
