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

/** 登録済みのスポーツ（1回あたりの消費カロリー）。 */
export interface SportDefinition {
  id: string;
  name: string;
  caloriesBurned: number;
}

export interface SportActivityLog {
  id: string;
  sportId: string;
  name: string;
  caloriesBurned: number;
  timestamp: number;
}

export type SportActivityInput = Omit<SportActivityLog, 'id'>;

export interface DailyLog {
  date: string; // YYYY-MM-DD
  items: FoodItem[];
  total: PFC;
  activities: SportActivityLog[];
}

export type Logs = Record<string, DailyLog>;

export interface UserProfile {
  gender: 'male' | 'female';
  age: number;
  height: number;
  weight: number;
  targetWeight: number;
  activityLevel: number; // 1.2, 1.375, 1.55, 1.725, 1.9
}

export interface GeoPoint {
  lat: number;
  lon: number;
}

/** 自宅・会社など、予定から居場所を推定するための地点。 */
export interface NamedPlace {
  /** 例: 自宅（中野駅） */
  label: string;
  point?: GeoPoint;
}

/** 食事提案で居場所を推定するための平日の予定。曜日は 0=日〜6=土。 */
export interface MealSchedule {
  home: NamedPlace;
  office: NamedPlace;
  /** HH:mm */
  workStart: string;
  /** HH:mm */
  workEnd: string;
  workDays: number[];
  /** 仕事の日のうち在宅勤務の曜日 */
  remoteDays: number[];
}

/** お店ごとの定番メニューや注文のしかた。 */
export interface StorePreference {
  store: string;
  /** 例: 牛丼ミニ＋サラダ＋とん汁が定番。紅しょうがは不要 */
  menu: string;
}

/** 食事提案で参考にする食の好み。 */
export interface MealPreferences {
  /** 食事提案で AI に渡す指示。苦手な食材などもここに書く */
  instructions: string;
  stores: StorePreference[];
}

export interface UserSettings {
  targetPFC: PFC;
  profile?: UserProfile;
  favoriteFoodIds: string[];
  /** 超過・不足を繰り越さない日（YYYY-MM-DD）。記録を入れ忘れた日などに使う */
  carryoverExcludedDates: string[];
  mealSchedule?: MealSchedule;
  mealPreferences?: MealPreferences;
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner';

/** 提案時に周辺で見つかった飲食店・小売店。 */
export interface NearbyStore {
  id: string;
  name: string;
  /** コンビニ・ファストフードなどの種別 */
  category: string;
  point: GeoPoint;
  /** 検索の起点（現在地・自宅・会社）の名前 */
  near: string;
  distanceM: number;
  /** 栄養成分を公開しているチェーン店なら true */
  isChain: boolean;
}

interface SuggestedFood extends PFC {
  name: string;
}

export interface MealSuggestionOption {
  store: string;
  items: SuggestedFood[];
  total: PFC;
  reason: string;
  /** 新商品を含むなら true */
  hasNewProduct: boolean;
}

export interface MealSuggestion {
  date: string;
  slot: MealSlot;
  createdAt: number;
  /** この食事の提案の一言（通知本文にも使う） */
  summary: string;
  options: MealSuggestionOption[];
  stores: NearbyStore[];
  sources: { title: string; url: string }[];
}

/** ログインユーザーの全データ。未保存の設定はサーバー側で既定値が補われる。 */
export interface UserData {
  logs: Logs;
  settings: UserSettings;
  foods: FoodItem[];
  sports: SportDefinition[];
}

/** その日の食事提案すべて（新しい順）と、提案に使う予定・気分。 */
export interface TodayMeal {
  date: string;
  note: string;
  suggestions: MealSuggestion[];
}

/** クライアントが起動時に読み込むデータ。提案画面をすぐ表示できるよう今日の食事提案も含める。 */
export interface AppData extends UserData {
  meal: TodayMeal;
}

/** GET /api/user-data のレスポンス。どのユーザーのデータかをクライアントのキャッシュ切り替えに使う。 */
export interface UserDataResponse {
  userId: string;
  data: AppData;
}

// 空 PFC 共通定数。直接参照すると意図せず共有されるため、利用側では必ずスプレッドで複製すること。
export const EMPTY_PFC: PFC = { protein: 0, fat: 0, carbs: 0, calories: 0 };

export function createEmptyDailyLog(date: string): DailyLog {
  return { date, items: [], total: { ...EMPTY_PFC }, activities: [] };
}

export interface MealSuggestionRequest {
  /** 提案し直す食事枠。省略時は今日これからの食事（朝昼晩のうち残り）をまとめて提案する */
  slot?: MealSlot;
  location?: GeoPoint;
  /** ユーザーが選んだお店。指定時はこの中からだけ提案する */
  stores?: NearbyStore[];
  /** 既に出した案の料理名。やり直し時に別の案を出させる（MEAL_SUGGESTION_AVOID_LIMIT まで） */
  avoid?: string[];
}

/** 食事提案に使うその日の予定・気分。 */
export interface MealNote {
  note: string;
}

/** やり直し時に避けさせる案の件数と、1 件あたりの文字数の上限。 */
export const MEAL_SUGGESTION_AVOID_LIMIT = { count: 30, length: 100 } as const;
