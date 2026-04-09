export interface FoodItemForKVS {
  name: string;
  protein: number;
  fat: number;
  carbs: number;
  calories: number;
  store?: string;
}

export interface BarcodeMappingRow {
  barcode: string;
  food: FoodItemForKVS;
}

export type FoodMatchKeyInput = Pick<FoodItemForKVS, 'name' | 'protein' | 'fat' | 'carbs' | 'calories'>;

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

export function buildFoodMatchKey(food: FoodMatchKeyInput): string {
  return [
    food.name.trim().toLowerCase(),
    Number(food.protein),
    Number(food.fat),
    Number(food.carbs),
    Number(food.calories),
  ].join('|');
}
