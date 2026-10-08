'use client';

import { toBarcodeFood } from '@/lib/barcode';
import {
  addFoodItem,
  rememberFood,
  updateFood,
  updateLogItem,
} from '@/lib/client/actions';
import { saveBarcodeMapping } from '@/lib/client/api';
import { scalePFC } from '@/lib/pfc';
import { toast } from '@/lib/toast';
import type { FoodItemInput } from '@/lib/types';

/** 食品の栄養値は 1 個分で保存し、食事記録だけ数量を掛ける。 */
export interface FoodRegistration {
  food: FoodItemInput;
  quantity: number;
  barcodes: string[];
  saveFood: boolean;
  record: boolean;
  photos?: string[];
}

/** 入口によらず、選択された保存先とバーコードに同じ内容を保存する。 */
export async function saveFoodRegistration(
  entry: FoodRegistration,
  target: { foodId?: string; logId?: string } = {},
): Promise<boolean> {
  try {
    if (entry.barcodes.length > 0) {
      await saveBarcodeMapping(entry.barcodes, toBarcodeFood(entry.food));
    }
    if (entry.saveFood) {
      const saved = target.foodId
        ? await updateFood({ ...entry.food, id: target.foodId })
        : await rememberFood(entry.food);
      if (!saved) return false;
    }
    if (entry.record) {
      const food = scalePFC(entry.food, entry.quantity);
      const saved = target.logId
        ? await updateLogItem({ ...food, id: target.logId })
        : await addFoodItem(food);
      if (!saved) return false;
    }
    return true;
  } catch (error) {
    toast.fromError('食品の保存に失敗しました', error);
    return false;
  }
}
