import type { GeoPoint, MealSchedule, MealSlot, NamedPlace } from '@/lib/types';
import { formatTime, toJstTimestamp } from '@/lib/utils';

/** 食事枠。time は提案通知を出す時刻（JST）。 */
export const MEAL_SLOTS = [
  { slot: 'breakfast', label: '朝ごはん', short: '朝', time: '07:00' },
  { slot: 'lunch', label: '昼ごはん', short: '昼', time: '11:00' },
  { slot: 'dinner', label: '晩ごはん', short: '夜', time: '17:00' },
] as const satisfies readonly {
  slot: MealSlot;
  label: string;
  short: string;
  time: string;
}[];

export function mealSlotLabel(slot: MealSlot): string {
  return MEAL_SLOTS.find((meta) => meta.slot === slot)?.label ?? slot;
}

/** その時刻に提案すべき食事枠。10時までは朝、15時までは昼、以降は夜。 */
export function slotForTime(timestamp: number): MealSlot {
  const time = formatTime(timestamp);
  if (time < '10:00') return 'breakfast';
  if (time < '15:00') return 'lunch';
  return 'dinner';
}

/** この食事を含め、今日あと何回食事があるか。 */
export function remainingMealCount(slot: MealSlot): number {
  return MEAL_SLOTS.length - MEAL_SLOTS.findIndex((meta) => meta.slot === slot);
}

export const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

export const DEFAULT_MEAL_SCHEDULE: MealSchedule = {
  home: { label: '自宅' },
  office: { label: '会社' },
  workStart: '09:00',
  workEnd: '18:00',
  workDays: [1, 2, 3, 4, 5],
  remoteDays: [5],
};

/** JST の日付(YYYY-MM-DD)の曜日（0=日〜6=土）。 */
export function weekdayOf(date: string): number {
  return new Date(toJstTimestamp(date, '12:00')).getUTCDay();
}

export interface MealPlan {
  /** AI に渡す今日の予定と、この食事のときの居場所の説明 */
  description: string[];
  /** 現在地のほかに周辺のお店を探す地点 */
  places: NamedPlace[];
}

/** 予定と曜日から、その食事をどこで・どのタイミングで取りそうかを推定する。 */
export function planMeal(
  schedule: MealSchedule | undefined,
  date: string,
  slot: MealSlot,
): MealPlan {
  const weekday = weekdayOf(date);
  const dayLabel = `${WEEKDAY_LABELS[weekday] ?? ''}曜日`;
  if (!schedule) {
    return {
      description: [`${dayLabel}。予定は未設定なので現在地の周辺で考える。`],
      places: [],
    };
  }

  const { home, office, workStart, workEnd } = schedule;
  if (!schedule.workDays.includes(weekday)) {
    return {
      description: [`${dayLabel}。仕事は休みの日。現在地の周辺で考える。`],
      places: [home],
    };
  }

  const hours = `${workStart}〜${workEnd}`;
  if (schedule.remoteDays.includes(weekday)) {
    return {
      description: [
        `${dayLabel}。在宅勤務の日（${hours}）。${home.label}の近くで買う・食べる。`,
      ],
      places: [home],
    };
  }

  const officeDay = `${dayLabel}。出社の日（${hours}、${office.label}）。`;
  switch (slot) {
    case 'breakfast':
      return {
        description: [
          officeDay,
          `朝は${home.label}から${office.label}へ ${workStart} までに通勤する。${home.label}の近く・通勤の途中・${office.label}の近くで買える物にする。`,
        ],
        places: [home, office],
      };
    case 'lunch':
      return {
        description: [
          officeDay,
          `昼は${office.label}の昼休み。${office.label}の近くで買う・食べる。`,
        ],
        places: [office],
      };
    case 'dinner':
      return {
        description: [
          officeDay,
          `夜は ${workEnd} の終業後に${office.label}から${home.label}へ帰る。${office.label}の近く・帰り道・${home.label}の近くで買える物にする。`,
        ],
        places: [office, home],
      };
  }
}

const EARTH_RADIUS_M = 6_371_000;

/** 2 地点間の距離（m）。 */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h)));
}
