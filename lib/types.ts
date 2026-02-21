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
  storeGroup?: string;
  timestamp: number;
}

export interface DailyLog {
  date: string; // YYYY-MM-DD
  items: FoodItem[];
  total: PFC;
  activities?: SportActivityLog[];
}

export interface SportDefinition {
  id: string;
  name: string;
  caloriesBurned: number;
}

export interface SportActivityLog extends SportDefinition {
  timestamp: number;
}

export interface UserProfile {
  gender: 'male' | 'female';
  age: number;
  height: number;
  weight: number;
  targetWeight: number;
  activityLevel: number; // 1.2, 1.375, 1.55, 1.725, 1.9
}

export interface UserSettings {
  targetPFC: PFC;
  profile?: UserProfile;
  favoriteFoodIds?: string[];
  sports?: SportDefinition[];
}

export const DEFAULT_TARGET: PFC = {
  protein: 100,
  fat: 60,
  carbs: 250,
  calories: 2000,
};
