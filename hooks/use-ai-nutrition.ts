'use client';

import { useState } from 'react';
import { toast } from '@/lib/toast';
import {
  estimateNutrition,
  estimateNutritionFromImage,
} from '@/lib/client/api';
import { imageToDataUrl } from '@/lib/client/image';
import type { BarcodeFood } from '@/lib/barcode';

/** 実行中の AI 入力の種類。 */
type AiNutritionPending = 'text' | 'image' | null;

/** テキストからの推定、または写真（栄養成分表示・料理）の読み取りで栄養値を得る。 */
export function useAiNutrition(onEstimated: (food: BarcodeFood) => void) {
  const [text, setText] = useState('');
  const [pending, setPending] = useState<AiNutritionPending>(null);

  /** 推定できたら true を返す。 */
  const run = async (
    kind: Exclude<AiNutritionPending, null>,
    request: () => Promise<BarcodeFood>,
  ): Promise<boolean> => {
    setPending(kind);
    try {
      onEstimated(await request());
      toast.success('AIでPFCとカロリーを入力しました');
      return true;
    } catch (error) {
      toast.fromError('AIでの入力に失敗しました', error);
      return false;
    } finally {
      setPending(null);
    }
  };

  /** 文章から推定する。省略時は入力欄の text を使う。 */
  const estimate = async (source: string = text) => {
    const input = source.trim();
    if (!input) {
      toast.info('食べた内容を入力してください');
      return false;
    }
    return run('text', () => estimateNutrition(input));
  };

  const estimateFromImage = (file: File) =>
    run('image', async () =>
      estimateNutritionFromImage(await imageToDataUrl(file)),
    );

  return { text, setText, pending, estimate, estimateFromImage };
}
