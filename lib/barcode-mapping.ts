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
