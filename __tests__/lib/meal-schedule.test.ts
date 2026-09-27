import { findChainStore } from '@/lib/chain-stores';
import {
  DEFAULT_MEAL_SCHEDULE,
  distanceMeters,
  planMeal,
  remainingMealCount,
  slotForTime,
  weekdayOf,
} from '@/lib/meal-schedule';
import type { MealSchedule } from '@/lib/types';
import { toJstTimestamp } from '@/lib/utils';

const schedule: MealSchedule = {
  ...DEFAULT_MEAL_SCHEDULE,
  home: { label: '自宅', point: { lat: 35.7, lon: 139.66 } },
  office: { label: '会社', point: { lat: 35.68, lon: 139.76 } },
};

// 2026-09-28 は月曜、2026-10-02 は金曜、2026-10-03 は土曜
const MONDAY = '2026-09-28';
const FRIDAY = '2026-10-02';
const SATURDAY = '2026-10-03';

describe('weekdayOf', () => {
  it('JST の日付の曜日を返す', () => {
    expect(weekdayOf(MONDAY)).toBe(1);
    expect(weekdayOf(FRIDAY)).toBe(5);
    expect(weekdayOf(SATURDAY)).toBe(6);
  });
});

describe('slotForTime', () => {
  it('時刻から食事枠を決める', () => {
    expect(slotForTime(toJstTimestamp(MONDAY, '07:00'))).toBe('breakfast');
    expect(slotForTime(toJstTimestamp(MONDAY, '11:00'))).toBe('lunch');
    expect(slotForTime(toJstTimestamp(MONDAY, '17:00'))).toBe('dinner');
  });
});

describe('remainingMealCount', () => {
  it('この食事を含む残りの食事回数', () => {
    expect(remainingMealCount('breakfast')).toBe(3);
    expect(remainingMealCount('lunch')).toBe(2);
    expect(remainingMealCount('dinner')).toBe(1);
  });
});

describe('planMeal', () => {
  it('出社日の朝は自宅と会社の周辺を調べる', () => {
    const plan = planMeal(schedule, MONDAY, 'breakfast');
    expect(plan.places.map((p) => p.label)).toEqual(['自宅', '会社']);
    expect(plan.description.join()).toContain('通勤');
  });

  it('出社日の昼は会社の周辺', () => {
    expect(
      planMeal(schedule, MONDAY, 'lunch').places.map((p) => p.label),
    ).toEqual(['会社']);
  });

  it('出社日の夜は会社から自宅への帰り道', () => {
    const plan = planMeal(schedule, MONDAY, 'dinner');
    expect(plan.places.map((p) => p.label)).toEqual(['会社', '自宅']);
    expect(plan.description.join()).toContain('18:00');
  });

  it('在宅勤務の日は自宅の周辺', () => {
    const plan = planMeal(schedule, FRIDAY, 'lunch');
    expect(plan.places.map((p) => p.label)).toEqual(['自宅']);
    expect(plan.description.join()).toContain('在宅勤務');
  });

  it('休みの日は仕事の予定を含めない', () => {
    const plan = planMeal(schedule, SATURDAY, 'lunch');
    expect(plan.description.join()).toContain('休み');
  });

  it('予定が未設定なら現在地だけで考える', () => {
    expect(planMeal(undefined, MONDAY, 'lunch').places).toEqual([]);
  });
});

describe('distanceMeters', () => {
  it('2 地点間の距離を返す', () => {
    // 東京駅〜新宿駅はおよそ 6.2km
    const distance = distanceMeters(
      { lat: 35.6812, lon: 139.7671 },
      { lat: 35.6896, lon: 139.7006 },
    );
    expect(distance).toBeGreaterThan(5900);
    expect(distance).toBeLessThan(6400);
  });
});

describe('findChainStore', () => {
  it('店名やブランド名の表記ゆれからチェーンを判定する', () => {
    expect(findChainStore('セブン-イレブン 新宿西口店')).toBe(
      'セブン-イレブン',
    );
    expect(findChainStore('新宿店', 'FamilyMart')).toBe('ファミリーマート');
    expect(findChainStore("McDonald's")).toBe('マクドナルド');
  });

  it('チェーンでなければ undefined', () => {
    expect(findChainStore('喫茶まるやま')).toBeUndefined();
  });
});
