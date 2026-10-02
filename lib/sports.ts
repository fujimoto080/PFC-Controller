import type { SportActivityInput, SportDefinition } from './types';
import { roundPFC } from './utils';

/** 運動強度。登録スポーツの METs に掛ける係数。 */
export const SPORT_INTENSITIES = [
  { value: 'light', label: '軽め', factor: 0.75 },
  { value: 'normal', label: '普通', factor: 1 },
  { value: 'hard', label: 'きつめ', factor: 1.25 },
] as const;

export type SportIntensity = (typeof SPORT_INTENSITIES)[number]['value'];

export const DEFAULT_SPORT_INTENSITY: SportIntensity = 'normal';
export const DEFAULT_SPORT_MINUTES = 30;

/** METs 換算の係数（kcal = METs × 体重kg × 時間 × 1.05）。 */
const KCAL_PER_MET_KG_HOUR = 1.05;

function intensityOf(intensity: SportIntensity) {
  return (
    SPORT_INTENSITIES.find(({ value }) => value === intensity) ??
    SPORT_INTENSITIES[1]
  );
}

/** METs・強度・運動時間(分)・体重から消費カロリー(kcal)を求める。 */
export function calculateSportCalories({
  mets,
  intensity,
  minutes,
  weight,
}: {
  mets: number;
  intensity: SportIntensity;
  minutes: number;
  weight: number;
}): number {
  return roundPFC(
    mets *
      intensityOf(intensity).factor *
      weight *
      (minutes / 60) *
      KCAL_PER_MET_KG_HOUR,
    0,
  );
}

/** 登録スポーツと今回の強度・時間・体重から運動記録を作る。 */
export function buildSportActivity(
  sport: SportDefinition,
  options: {
    intensity: SportIntensity;
    minutes: number;
    weight: number;
    timestamp: number;
  },
): SportActivityInput {
  const { intensity, minutes, weight, timestamp } = options;
  return {
    sportId: sport.id,
    name: `${sport.name} ${minutes}分（${intensityOf(intensity).label}）`,
    caloriesBurned: calculateSportCalories({
      mets: sport.mets,
      intensity,
      minutes,
      weight,
    }),
    timestamp,
  };
}
