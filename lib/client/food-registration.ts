'use client';

import { toBarcodeFood } from '@/lib/barcode';
import {
  addFoodItem,
  applySavedScanEntries,
  hasRememberedFood,
  rememberFood,
  updateFood,
  updateLogItem,
} from '@/lib/client/actions';
import { api, saveBarcodeMapping } from '@/lib/client/api';
import type { SavedScanEntry, ScanSaveEntry } from '@/lib/scan-batch';
import { toast } from '@/lib/toast';
import type { FoodItemInput } from '@/lib/types';

/** 食品の栄養値は1個分で保存し、食事記録には数量も渡す。 */
export interface FoodRegistration {
  food: FoodItemInput;
  quantity: number;
  barcodes: string[];
  photos?: string[];
}

/** 新しい食事記録と必要な食品・バーコードをまとめて保存する。 */
export async function saveFoodEntries(
  entries: ScanSaveEntry[],
): Promise<SavedScanEntry[]> {
  const saved = await api.post<SavedScanEntry[]>(
    '/api/log-items/batch',
    entries,
  );
  applySavedScanEntries(saved);
  return saved;
}

/** 入口によらず、食品リスト・食事記録とバーコードに同じ内容を保存する。 */
export async function saveFoodRegistration(
  entry: FoodRegistration,
  target: { id: string; foodId?: string; logId?: string },
): Promise<boolean> {
  const food = { ...entry.food, quantity: entry.quantity };
  try {
    if (!target.foodId && !target.logId) {
      if (entry.barcodes.length === 0 && hasRememberedFood(entry.food)) {
        return await addFoodItem(food);
      }
      const saved = await saveFoodEntries([
        { id: target.id, input: food, barcodes: entry.barcodes },
      ]);
      if (saved.length === 0) {
        throw new Error('食事記録を保存できませんでした');
      }
      return true;
    }

    if (entry.barcodes.length > 0) {
      await saveBarcodeMapping(entry.barcodes, toBarcodeFood(entry.food));
    }
    const foodSaved = target.foodId
      ? await updateFood({ ...entry.food, id: target.foodId })
      : await rememberFood(entry.food);
    if (!foodSaved) return false;
    const saved = target.logId
      ? await updateLogItem({ ...food, id: target.logId })
      : await addFoodItem(food);
    if (!saved) return false;
    return true;
  } catch (error) {
    toast.fromError('食品の保存に失敗しました', error);
    return false;
  }
}
