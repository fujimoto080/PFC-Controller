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

export type FoodItemInput = Omit<FoodItem, 'id'>;

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

export interface SportActivityLog {
  id: string; // 活動ログの一意 id (DB 採番 UUID)
  sportId: string; // SportDefinition.id（種目）
  name: string;
  caloriesBurned: number;
  timestamp: number;
}

export type SportActivityInput = Omit<SportActivityLog, 'id'>;

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

// 空 PFC 共通定数。直接参照すると意図せず共有されるため、利用側では必ずスプレッドで複製すること。
export const EMPTY_PFC: PFC = { protein: 0, fat: 0, carbs: 0, calories: 0 };

// 空の DailyLog を生成するファクトリ。total は EMPTY_PFC を複製して独立したオブジェクトを返す。
export function createEmptyDailyLog(date: string): DailyLog {
  return { date, items: [], activities: [], total: { ...EMPTY_PFC } };
}
