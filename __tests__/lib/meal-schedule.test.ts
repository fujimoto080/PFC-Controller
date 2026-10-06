import { findChainStore } from '@/lib/chain-stores';
import {
  assignMealSlots,
  DEFAULT_MEAL_SCHEDULE,
  distanceMeters,
  planMeal,
  slotForTime,
  upcomingSlots,
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

describe('assignMealSlots', () => {
  const at = (time: string) => ({ timestamp: toJstTimestamp(MONDAY, time) });
  const slotsOf = (times: string[]) =>
    assignMealSlots(times.map(at)).map((meal) => [
      meal.slot,
      meal.items.length,
    ]);

  it('時間帯どおりの 3 回の食事を朝昼夜に分ける', () => {
    expect(slotsOf(['19:00', '07:30', '12:00'])).toEqual([
      ['breakfast', 1],
      ['lunch', 1],
      ['dinner', 1],
    ]);
  });

  it('1 時間以内に続けて食べた物は同じ 1 回の食事にまとめる', () => {
    expect(slotsOf(['12:00', '12:40', '13:30', '19:00'])).toEqual([
      ['lunch', 3],
      ['dinner', 1],
    ]);
  });

  it('朝の時間帯を過ぎた 1 回目も、その後に昼と夜があれば朝にする', () => {
    expect(slotsOf(['10:30', '13:00', '19:00'])).toEqual([
      ['breakfast', 1],
      ['lunch', 1],
      ['dinner', 1],
    ]);
  });

  it('朝を抜いた日の遅めの 1 回目は昼にする', () => {
    expect(slotsOf(['10:30', '19:00'])).toEqual([
      ['lunch', 1],
      ['dinner', 1],
    ]);
  });

  it('夕食後の夜食は夜にまとめる', () => {
    expect(slotsOf(['07:00', '12:00', '19:00', '23:00'])).toEqual([
      ['breakfast', 1],
      ['lunch', 1],
      ['dinner', 2],
    ]);
  });

  it('記録が無ければ空', () => {
    expect(assignMealSlots([])).toEqual([]);
  });
});

describe('upcomingSlots', () => {
  const now = (time: string) => toJstTimestamp(MONDAY, time);

  it('何も食べていなければ今の時間帯から', () => {
    expect(upcomingSlots([], now('07:00'))).toEqual([
      'breakfast',
      'lunch',
      'dinner',
    ]);
    expect(upcomingSlots([], now('11:00'))).toEqual(['lunch', 'dinner']);
  });

  it('食べた最後の食事枠の次から', () => {
    expect(upcomingSlots([{ slot: 'breakfast' }], now('08:00'))).toEqual([
      'lunch',
      'dinner',
    ]);
    expect(upcomingSlots([{ slot: 'lunch' }], now('13:00'))).toEqual([
      'dinner',
    ]);
  });

  it('時間帯を過ぎた食事枠は食べていなくても飛ばす', () => {
    expect(upcomingSlots([{ slot: 'breakfast' }], now('16:00'))).toEqual([
      'dinner',
    ]);
  });

  it('夜まで食べ終えていても夜は残す', () => {
    expect(upcomingSlots([{ slot: 'dinner' }], now('20:00'))).toEqual([
      'dinner',
    ]);
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
