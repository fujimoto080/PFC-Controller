export interface PFC {
  protein: number;
  fat: number;
  carbs: number;
  calories: number;
}

export interface FoodItem extends PFC {
  id: string;
  name: string;
  image?: string; // base64 or url
  store?: string;
  timestamp: number;
}

export interface DailyLog {
  date: string; // YYYY-MM-DD
  items: FoodItem[];
  total: PFC;
}

export interface UserSettings {
  targetPFC: PFC;
}

export const DEFAULT_TARGET: PFC = {
  protein: 100,
  fat: 60,
  carbs: 250,
  calories: 2000,
};
