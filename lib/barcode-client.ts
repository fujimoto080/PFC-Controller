'use client';

import type { BarcodeFood } from './barcode-mapping';
import { apiPost } from './api-client';

/**
 * バーコード↔食品のマッピングを保存する。食品追加フローの副作用であり、
 * 失敗しても本体の操作は止めないベストエフォート（エラーは握りつぶして warn のみ）。
 */
export async function saveBarcodeMappingRequest(
  barcodes: string[],
  foodData: BarcodeFood,
): Promise<void> {
  if (barcodes.length === 0) return;

  try {
    await apiPost('/api/barcode', { barcodes, foodData }, 'バーコードの保存に失敗しました');
  } catch (error) {
    console.warn('バーコードマッピングの保存に失敗しました', error);
  }
}
