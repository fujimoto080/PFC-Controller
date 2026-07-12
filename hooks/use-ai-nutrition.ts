'use client';

import { useState } from 'react';
import { toast } from '@/lib/toast';
import { estimateNutrition, ocrImage } from '@/lib/nutrition-client';
import type { BarcodeFood } from '@/lib/barcode-mapping';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
        return;
      }
      reject(new Error('画像の読み込みに失敗しました'));
    };
    reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    reader.readAsDataURL(file);
  });
}

interface UseAiNutritionOptions {
  /** フォームへ栄養データを流し込む。反映できたら true を返す。 */
  applyFoodData: (data: BarcodeFood) => boolean;
  /** 反映に成功した後の処理（タブ切り替えなど）。 */
  onApplied: () => void;
}

/** テキスト/画像から AI 推定・OCR を行い、結果をフォームへ反映するフック。 */
export function useAiNutrition({ applyFoodData, onApplied }: UseAiNutritionOptions) {
  const [aiInputText, setAiInputText] = useState('');
  const [isEstimatingNutrition, setIsEstimatingNutrition] = useState(false);
  const [isExtractingText, setIsExtractingText] = useState(false);

  const handleEstimateByAi = async () => {
    const text = aiInputText.trim();
    if (!text) {
      toast.info('食べた内容を入力してください');
      return;
    }

    setIsEstimatingNutrition(true);
    try {
      const result = await estimateNutrition(text);
      if (applyFoodData(result)) {
        onApplied();
        toast.success('AIでPFCとカロリーを入力しました');
        return;
      }
      toast.error('AI結果の入力に失敗しました');
    } catch (error) {
      toast.fromError('AI推定に失敗しました', error);
    } finally {
      setIsEstimatingNutrition(false);
    }
  };

  const handleExtractTextFromImage = async (file: File | null) => {
    if (!file) return;

    setIsExtractingText(true);
    const loadingToast = toast.loading('画像から文字を抽出中...');
    try {
      const imageDataUrl = await readFileAsDataUrl(file);
      const extractedText = await ocrImage(imageDataUrl);

      if (!extractedText) {
        toast.dismiss(loadingToast);
        toast.info('文字を抽出できませんでした。別の写真でお試しください');
        return;
      }

      setAiInputText(extractedText);
      toast.dismiss(loadingToast);
      toast.success('文字を抽出しました。内容を確認してAI推定してください');
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.fromError('OCRに失敗しました', error);
    } finally {
      setIsExtractingText(false);
    }
  };

  return {
    aiInputText,
    setAiInputText,
    isEstimatingNutrition,
    isExtractingText,
    handleEstimateByAi,
    handleExtractTextFromImage,
  };
}
