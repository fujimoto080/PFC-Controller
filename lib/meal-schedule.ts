import type { GeoPoint, MealSchedule, MealSlot, NamedPlace } from '@/lib/types';
import { formatTime, toJstTimestamp } from '@/lib/utils';

export const MEAL_SLOTS = [
  { slot: 'breakfast', label: '朝ごはん' },
  { slot: 'lunch', label: '昼ごはん' },
  { slot: 'dinner', label: '晩ごはん' },
] as const satisfies readonly { slot: MealSlot; label: string }[];

export function mealSlotLabel(slot: MealSlot): string {
  return MEAL_SLOTS.find((meta) => meta.slot === slot)?.label ?? slot;
}

/** 食事枠の時間帯（JST の 0 時からの分、終わりは含まない）。10時までは朝、15時までは昼、以降は夜。 */
const SLOT_WINDOWS: Record<MealSlot, readonly [number, number]> = {
  breakfast: [0, 10 * 60],
  lunch: [10 * 60, 15 * 60],
  dinner: [15 * 60, 24 * 60],
};

/** JST の 0 時からの分。 */
function minutesOfDay(timestamp: number): number {
  const [hours = 0, minutes = 0] = formatTime(timestamp).split(':').map(Number);
  return hours * 60 + minutes;
}

/** 時刻が食事枠の時間帯から何分外れているか。時間帯の中なら 0。 */
function minutesOutside(slot: MealSlot, minutes: number): number {
  const [start, end] = SLOT_WINDOWS[slot];
  return Math.max(0, start - minutes, minutes - (end - 1));
}

/** その時刻に提案すべき食事枠。 */
export function slotForTime(timestamp: number): MealSlot {
  const minutes = minutesOfDay(timestamp);
  return (
    MEAL_SLOTS.find((meta) => minutesOutside(meta.slot, minutes) === 0)?.slot ??
    'dinner'
  );
}

/** 前の記録からこの間隔以内に食べた物は、同じ 1 回の食事と数える。 */
const SAME_MEAL_GAP_MS = 60 * 60 * 1000;

/** 2 回の食事を同じ食事枠に入れるときの重み（時間帯から外れる分数に換算）。 */
const SHARED_SLOT_PENALTY = 60;

interface SlotPath {
  cost: number;
  slots: MealSlot[];
}

/** 食べた物それぞれに割り当てた食事枠を付け、時刻順に並べる。 */
export function withMealSlots<T extends { timestamp: number }>(
  items: readonly T[],
): (T & { slot: MealSlot })[] {
  return assignMealSlots(items).flatMap(({ slot, items: meal }) =>
    meal.map((item) => ({ ...item, slot })),
  );
}

/**
 * 食べた物を朝・昼・夜に割り当てる。記録を食事 1 回ずつにまとめ、食事の順番は
 * 朝→昼→夜を逆戻りしない範囲で、時間帯からの外れと同じ枠への詰め込みが最も少ない割り当てを選ぶ。
 * 例えば 10:30・13:00・19:00 の 3 回なら 10:30 は朝、10:30・19:00 の 2 回なら 10:30 は昼になる。
 */
export function assignMealSlots<T extends { timestamp: number }>(
  items: readonly T[],
): { slot: MealSlot; items: T[] }[] {
  const meals: T[][] = [];
  for (const item of [...items].sort((a, b) => a.timestamp - b.timestamp)) {
    const meal = meals.at(-1);
    const last = meal?.at(-1);
    if (meal && last && item.timestamp - last.timestamp <= SAME_MEAL_GAP_MS) {
      meal.push(item);
    } else {
      meals.push([item]);
    }
  }

  // paths[s]: ここまでの食事を割り当て、直前の食事を MEAL_SLOTS[s] にしたときの最小の重み
  let paths: SlotPath[] = MEAL_SLOTS.map(() => ({ cost: 0, slots: [] }));
  for (const meal of meals) {
    const minutes = minutesOfDay(meal[0]?.timestamp ?? 0);
    paths = MEAL_SLOTS.map(({ slot }, s) => {
      const best = paths
        .slice(0, s + 1)
        .map((path, p) => ({
          ...path,
          cost:
            path.cost +
            (p === s && path.slots.length > 0 ? SHARED_SLOT_PENALTY : 0),
        }))
        .reduce((a, b) => (b.cost < a.cost ? b : a));
      return {
        cost: best.cost + minutesOutside(slot, minutes),
        slots: [...best.slots, slot],
      };
    });
  }
  const { slots } = paths.reduce((a, b) => (b.cost < a.cost ? b : a));

  return MEAL_SLOTS.map(({ slot }) => ({
    slot,
    items: meals.filter((_, i) => slots[i] === slot).flat(),
  })).filter((group) => group.items.length > 0);
}

const slotIndex = (slot: MealSlot) =>
  MEAL_SLOTS.findIndex((meta) => meta.slot === slot);

/**
 * 今日これから食べる食事枠。今の時間帯の枠と、食べた物を割り当てた最後の枠の次のうち遅いほうから夜まで。
 * 夜まで食べ終えていても、残りで食べ足す分として夜は残す。
 */
export function upcomingSlots(
  eaten: readonly { slot: MealSlot }[],
  now: number,
): MealSlot[] {
  const afterEaten = Math.max(
    0,
    ...eaten.map(({ slot }) =>
      Math.min(slotIndex(slot) + 1, MEAL_SLOTS.length - 1),
    ),
  );
  return MEAL_SLOTS.slice(
    Math.max(slotIndex(slotForTime(now)), afterEaten),
  ).map((meta) => meta.slot);
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
