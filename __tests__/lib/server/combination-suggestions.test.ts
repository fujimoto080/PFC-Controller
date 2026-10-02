/** @jest-environment node */
import { combinationsNear } from '@/lib/server/combination-suggestions';
import type { NearbyStore } from '@/lib/types';

// DB まで読み込まないよう、栄養の状況を読むモジュールは差し替える
jest.mock('@/lib/server/meal-context', () => ({}));

const store = (name: string, category: string): NearbyStore => ({
  id: name,
  name,
  category,
  point: { lat: 35, lon: 139 },
  near: '現在地',
  distanceM: 100,
  isChain: true,
});

const TARGET = { calories: 600, protein: 40, fat: 15, carbs: 75 };

describe('combinationsNear', () => {
  it('カタログのあるお店は、店名にお店の名前を含めば候補にする', () => {
    const near = combinationsNear(
      [store('マクドナルド 渋谷店', 'ファストフード')],
      TARGET,
      2,
    );
    expect(near.map((n) => n.store)).toEqual(['マクドナルド']);
    expect(near[0]?.combinations).toHaveLength(2);
  });

  it('コンビニの候補にはメーカーの既製品も入る', () => {
    const [seven] = combinationsNear(
      [store('セブン-イレブン 渋谷店', 'コンビニ')],
      { calories: 300, protein: 40, fat: 3, carbs: 20 },
      3,
    );
    expect(seven?.store).toBe('セブン-イレブン');
    expect(seven?.combinations.some((c) => c.items.some((i) => i.maker))).toBe(
      true,
    );
  });

  it('カタログの無いスーパーはメーカーの既製品だけから組み合わせる', () => {
    const near = combinationsNear(
      [store('まいばすけっと', 'スーパー')],
      TARGET,
      1,
    );
    expect(near.map((n) => n.store)).toEqual(['スーパー・ドラッグストア']);
    expect(near[0]?.combinations[0]?.items.every((i) => i.maker)).toBe(true);
  });

  it('カタログの無い飲食店だけなら候補は無い', () => {
    expect(
      combinationsNear([store('近所の定食屋', '飲食店')], TARGET, 1),
    ).toEqual([]);
  });
});
