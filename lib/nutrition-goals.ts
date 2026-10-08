import type { PFC, UserProfile } from './types';
import { roundPFC } from './utils';

/** 体脂肪 1kg あたりのエネルギー量(kcal)。 */
const KCAL_PER_KG = 7200;
const DAYS_PER_MONTH = 30;
/** 1ヶ月あたりの安全な減量ペース（現在体重に対する割合）。 */
const SAFE_MONTHLY_LOSS_RATE = 0.05;

export const DEFAULT_PROFILE: UserProfile = {
  gender: 'male',
  age: 30,
  height: 170,
  weight: 70,
  targetWeight: 65,
  activityLevel: 1.375,
};

export const ACTIVITY_LEVELS = [
  { value: 1.2, label: 'ほぼ運動しない' },
  { value: 1.375, label: '軽い運動（週1-3回）' },
  { value: 1.55, label: '中程度の運動（週3-5回）' },
  { value: 1.725, label: '激しい運動（週6-7回）' },
  { value: 1.9, label: '非常に激しい運動' },
] as const;

/** 健康維持のため下回らないようにする1日の最低摂取カロリー。 */
export function minimumCalories(gender: UserProfile['gender']): number {
  return gender === 'male' ? 1500 : 1200;
}

/** Mifflin-St Jeor 式の性別補正項。 */
export function bmrGenderOffset(gender: UserProfile['gender']): number {
  return gender === 'male' ? 5 : -161;
}

/** 基礎代謝量 (Mifflin-St Jeor 式)。 */
export function calculateBMR({
  weight,
  height,
  age,
  gender,
}: UserProfile): number {
  return roundPFC(
    10 * weight + 6.25 * height - 5 * age + bmrGenderOffset(gender),
    0,
  );
}

/** 維持カロリー (TDEE)。 */
export function calculateTDEE(profile: UserProfile): number {
  return roundPFC(calculateBMR(profile) * profile.activityLevel, 0);
}

export function calculateBMI({ weight, height }: UserProfile): number {
  return weight / (height / 100) ** 2;
}

export interface GoalBreakdown extends PFC {
  bmr: number;
  tdee: number;
  /** 目標体重に向けた1日あたりの調整カロリー（減量なら負） */
  calorieAdjustment: number;
  /** 最低カロリーでの下限適用前の目標カロリー */
  caloriesBeforeLimit: number;
  minimumCalories: number;
}

/** プロフィールと目標期間(月)から1日の目標 PFC とその計算内訳を求める。減量の赤字は維持カロリーの20%まで。Pは体重×1.6g、Fは25%、Cは残り。 */
export function calculateGoals(
  profile: UserProfile,
  durationMonths: number,
): GoalBreakdown {
  const bmr = calculateBMR(profile);
  const tdee = calculateTDEE(profile);
  const weightDifference = profile.targetWeight - profile.weight;
  const requestedAdjustment =
    durationMonths > 0
      ? (weightDifference * KCAL_PER_KG) / (durationMonths * DAYS_PER_MONTH)
      : 0;
  const calorieAdjustment = Math.max(requestedAdjustment, -tdee * 0.2);
  const caloriesBeforeLimit = tdee + calorieAdjustment;
  const minimum = minimumCalories(profile.gender);
  const calories = roundPFC(Math.max(caloriesBeforeLimit, minimum), 0);
  const protein = roundPFC(
    Math.min(profile.weight * 1.6, (calories * 0.4) / 4),
    1,
  );
  const fat = roundPFC((calories * 0.25) / 9, 1);
  const carbs = roundPFC((calories - protein * 4 - fat * 9) / 4, 1);

  return {
    protein,
    fat,
    carbs,
    calories,
    bmr,
    tdee,
    calorieAdjustment: roundPFC(calorieAdjustment, 0),
    caloriesBeforeLimit: roundPFC(caloriesBeforeLimit, 0),
    minimumCalories: minimum,
  };
}

export interface RecommendedDuration {
  /** 月5%ルールでの最短期間(月) */
  byWeightLoss: number;
  /** 赤字20%と最低カロリーを守った場合の最短期間(月) */
  byCalorieLimit: number;
  /** 上記のうち長い方（より安全な期間）。減量でなければ 0 */
  recommended: number;
}

/** 減量時の推奨期間(月)。 */
export function calculateRecommendedDuration(
  profile: UserProfile,
): RecommendedDuration {
  const weightToLose = profile.weight - profile.targetWeight;
  if (weightToLose <= 0) {
    return { byWeightLoss: 0, byCalorieLimit: 0, recommended: 0 };
  }

  const byWeightLoss = weightToLose / (profile.weight * SAFE_MONTHLY_LOSS_RATE);
  const tdee = calculateTDEE(profile);
  const maxDailyDeficit = Math.min(
    tdee * 0.2,
    tdee - minimumCalories(profile.gender),
  );
  // 維持カロリーが既に最低カロリー以下なら食事制限だけでの安全な減量は難しいため長めの期間とする
  const byCalorieLimit =
    maxDailyDeficit > 0
      ? (weightToLose * KCAL_PER_KG) / (DAYS_PER_MONTH * maxDailyDeficit)
      : 12;

  return {
    byWeightLoss: roundPFC(byWeightLoss, 1),
    byCalorieLimit: roundPFC(byCalorieLimit, 1),
    recommended: roundPFC(Math.max(byWeightLoss, byCalorieLimit), 1),
  };
}

/** プロフィールから自動で決まる目標期間(月)。推奨期間を採用し、減量でない場合は 3ヶ月。 */
export function targetDuration(profile: UserProfile): number {
  return calculateRecommendedDuration(profile).recommended || 3;
}
