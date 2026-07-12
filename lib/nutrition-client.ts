'use client';

import type { BarcodeFood } from './barcode-mapping';
import { apiPost, readErrorMessage } from './api-client';

/**
 * バーコードから登録済み食品を引く。未登録(404)は null、その他のエラーは throw。
 */
export async function fetchBarcodeFood(code: string): Promise<BarcodeFood | null> {
  const response = await fetch(`/api/barcode?code=${encodeURIComponent(code)}`);
  if (response.ok) {
    return (await response.json()) as BarcodeFood;
  }
  if (response.status === 404) {
    return null;
  }
  throw new Error(await readErrorMessage(response, '商品情報の取得に失敗しました'));
}

/** テキストから AI で PFC・カロリーを推定する。 */
export function estimateNutrition(text: string): Promise<BarcodeFood> {
  return apiPost<BarcodeFood>('/api/ai-nutrition', { text }, 'AI推定に失敗しました');
}

/** 画像(dataURL)から OCR でテキストを抽出する。抽出できない場合は空文字。 */
export async function ocrImage(imageDataUrl: string): Promise<string> {
  const result = await apiPost<{ text?: string }>('/api/ocr', { imageDataUrl }, 'OCRに失敗しました');
  return (result.text ?? '').trim();
}
