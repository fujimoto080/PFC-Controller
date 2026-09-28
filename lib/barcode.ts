import type { FoodItem } from '@/lib/types';

export type BarcodeFood = Pick<
  FoodItem,
  'name' | 'protein' | 'fat' | 'carbs' | 'calories' | 'store'
>;

/** 写真から読み取った値の確かさ。AI 自身の判断 */
export const READING_CONFIDENCES = ['high', 'medium', 'low'] as const;
export type ReadingConfidence = (typeof READING_CONFIDENCES)[number];

export interface ImageReadingFood {
  food: BarcodeFood;
  confidence: ReadingConfidence;
}

/** 写真の AI 読み取り結果。response は AI が返したテキストそのもの（確認用） */
export interface ImageReading {
  foods: ImageReadingFood[];
  response: string;
}

export interface BarcodeMappingRow {
  barcode: string;
  food: BarcodeFood;
}

/** 食品から バーコードマッピングに保存する項目だけを取り出す。 */
export function toBarcodeFood({
  name,
  protein,
  fat,
  carbs,
  calories,
  store,
}: BarcodeFood): BarcodeFood {
  return { name, protein, fat, carbs, calories, store };
}

export function normalizeBarcodes(value: string | string[]): string[] {
  const source = Array.isArray(value) ? value : [value];

  return Array.from(
    new Set(
      source
        .flatMap((item) => item.split(/[\s,、，]+/))
        .map((barcode) => barcode.trim())
        .filter(Boolean),
    ),
  );
}

/** 食品名と栄養値から、バーコードマッピングと食品辞書を突き合わせるためのキーを作る。 */
export function buildFoodMatchKey(food: BarcodeFood): string {
  return [
    food.name.trim().toLowerCase(),
    food.protein,
    food.fat,
    food.carbs,
    food.calories,
  ].join('|');
}
