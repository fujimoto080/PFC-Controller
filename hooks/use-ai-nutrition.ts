'use client';

import { useState } from 'react';
import { toast } from '@/lib/toast';
import {
  estimateNutrition,
  estimateNutritionFromImages,
} from '@/lib/client/api';
import { imageToDataUrl } from '@/lib/client/image';
import { MAX_READING_IMAGES, type BarcodeFood } from '@/lib/barcode';

/** 実行中の AI 入力の種類。 */
type AiNutritionPending = 'text' | 'image' | null;

/** 推定できた栄養値と、写真から読み取った場合はその写真（dataURL）。 */
interface Estimation {
  food: BarcodeFood;
  photos?: string[];
}

/** テキストからの推定、または写真（栄養成分表示・料理）の読み取りで栄養値を得る。写真から読み取ったときは、見比べられるよう元の写真も渡す。 */
export function useAiNutrition(
  onEstimated: (food: BarcodeFood, photos?: string[]) => void,
) {
  const [text, setText] = useState('');
  const [pending, setPending] = useState<AiNutritionPending>(null);

  /** 推定できたら true を返す。 */
  const run = async (
    kind: Exclude<AiNutritionPending, null>,
    request: () => Promise<Estimation>,
  ): Promise<boolean> => {
    setPending(kind);
    try {
      const { food, photos } = await request();
      onEstimated(food, photos);
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
    return run('text', async () => ({ food: await estimateNutrition(input) }));
  };

  /** 同じ商品を撮った写真（複数可）から推定する。 */
  const estimateFromImages = (files: File[], previousPhotos: string[] = []) =>
    run('image', async () => {
      const photos = [
        ...previousPhotos,
        ...(await Promise.all(files.map(imageToDataUrl))),
      ].slice(0, MAX_READING_IMAGES);
      return { food: await estimateNutritionFromImages(photos), photos };
    });

  return { text, setText, pending, estimate, estimateFromImages };
}
