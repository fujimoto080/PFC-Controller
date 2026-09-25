'use client';

import { useState } from 'react';
import { toast } from '@/lib/toast';
import { estimateNutrition, ocrImage } from '@/lib/client/api';
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

/** テキストから AI で栄養を推定し、画像からは OCR でテキストを抽出する。 */
export function useAiNutrition(onEstimated: (food: BarcodeFood) => void) {
  const [text, setText] = useState('');
  const [isEstimating, setIsEstimating] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  const estimate = async () => {
    const input = text.trim();
    if (!input) {
      toast.info('食べた内容を入力してください');
      return;
    }
    setIsEstimating(true);
    try {
      onEstimated(await estimateNutrition(input));
      toast.success('AIでPFCとカロリーを入力しました');
    } catch (error) {
      toast.fromError('AI推定に失敗しました', error);
    } finally {
      setIsEstimating(false);
    }
  };

  const extractFromImage = async (file: File) => {
    setIsExtracting(true);
    try {
      const extracted = await toast.withLoading(
        '画像から文字を抽出中...',
        async () => ocrImage(await readFileAsDataUrl(file)),
      );
      if (!extracted) {
        toast.info('文字を抽出できませんでした。別の写真でお試しください');
        return;
      }
      setText(extracted);
      toast.success('文字を抽出しました。内容を確認してAI推定してください');
    } catch (error) {
      toast.fromError('OCRに失敗しました', error);
    } finally {
      setIsExtracting(false);
    }
  };

  return {
    text,
    setText,
    isEstimating,
    isExtracting,
    estimate,
    extractFromImage,
  };
}
