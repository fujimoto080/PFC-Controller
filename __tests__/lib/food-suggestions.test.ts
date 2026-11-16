import {
  findFoodMergeCandidates,
  foodCandidateKey,
  rankFrequentFoods,
  createFoodCandidateSearch,
} from '@/lib/food-suggestions';
import { buildLogItem } from '@/lib/pfc';
import {
  createEmptyDailyLog,
  type FoodAlias,
  type FoodItem,
  type Logs,
} from '@/lib/types';

const foods: [FoodItem, ...FoodItem[]] = [
  {
    id: '1',
    name: 'サラダチキン',
    protein: 23,
    fat: 1,
    carbs: 1,
    calories: 120,
    timestamp: 1,
  },
  {
    id: '2',
    name: 'サラダ チキン バジル',
    protein: 20,
    fat: 3,
    carbs: 2,
    calories: 130,
    timestamp: 1,
  },
  {
    id: '3',
    name: 'おにぎり鮭',
    protein: 6,
    fat: 2,
    carbs: 38,
    calories: 180,
    timestamp: 1,
  },
];

describe('findFoodMergeCandidates', () => {
  it('カロリーや名前が異なってもP・F・Cがすべて一致する食品をまとめる', () => {
    const original = foods[0];
    const duplicate = {
      ...original,
      id: 'duplicate',
      name: '蒸し鶏',
      calories: 125,
    };
    const other = {
      ...original,
      id: 'other',
      carbs: original.carbs + 0.01,
    };
    expect(
      findFoodMergeCandidates([...foods, duplicate, other]).map(
        (group) => group.foods,
      ),
    ).toEqual([[original, duplicate]]);
  });
});

describe('createFoodCandidateSearch', () => {
  const searchFoodCandidates = (
    items: FoodItem[],
    logs: Logs,
    query: string,
    aliases: Record<string, FoodAlias>,
  ) => createFoodCandidateSearch(items, logs, aliases)(query);
  const eaten = (id: string, timestamp: number, food: FoodItem) =>
    buildLogItem(id, { ...food, timestamp, quantity: 1 });
  const [chicken, basil, onigiri] = foods as [FoodItem, FoodItem, FoodItem];
  const logs: Logs = {
    '2026-09-24': {
      ...createEmptyDailyLog('2026-09-24'),
      items: [eaten('log-1', 100, onigiri), eaten('log-2', 300, chicken)],
    },
    '2026-09-25': {
      ...createEmptyDailyLog('2026-09-25'),
      items: [eaten('log-3', 200, onigiri)],
    },
  };

  it('過去の記録を新しい順に並べ、同じ内容は 1 件にまとめて食品リストを続ける', () => {
    expect(
      searchFoodCandidates(foods, logs, '', {}).map((food) => food.id),
    ).toEqual(['log-2', 'log-3', '2']);
  });

  it('区切り文字を無視して食品名に検索語を含むものに絞る', () => {
    expect(
      searchFoodCandidates(foods, logs, 'チキン バジル', {}).map(
        (food) => food.id,
      ),
    ).toEqual([basil.id]);
  });

  it('名称の表記ゆれと記録の数量を吸収し、店舗や栄養値が異なる候補を残す', () => {
    const stored = { ...chicken, store: 'セブンイレブン' };
    const date = '2026-09-24';
    const recent = buildLogItem('recent', {
      ...stored,
      name: 'ｻﾗﾀﾞ　ﾁｷﾝ',
      store: 'セブン・イレブン',
      timestamp: 300,
      quantity: 4,
    });
    const history = {
      [date]: { ...createEmptyDailyLog(date), items: [recent] },
    };
    const candidates = searchFoodCandidates(
      [
        stored,
        { ...stored, id: 'other-store', store: 'ローソン' },
        { ...stored, id: 'other-nutrition', protein: 25 },
      ],
      history,
      'サラダチキン',
      {},
    );
    expect(candidates.map((food) => food.id)).toEqual([
      'recent',
      'other-store',
      'other-nutrition',
    ]);
    expect(candidates[0]).toMatchObject({ protein: 23, calories: 120 });
  });

  it('店名でも検索でき、店名と食品名を組み合わせて絞り込める', () => {
    const stored = [
      { ...chicken, id: 's1', store: 'セブンイレブン' },
      { ...onigiri, id: 's2', store: 'セブンイレブン' },
      { ...chicken, id: 's3', protein: 25, store: 'ローソン' },
    ];
    expect(
      searchFoodCandidates(stored, {}, 'セブン', {}).map((food) => food.id),
    ).toEqual(['s1', 's2']);
    expect(
      searchFoodCandidates(stored, {}, 'セブン チキン', {}).map(
        (food) => food.id,
      ),
    ).toEqual(['s1']);
  });

  it('名寄せ後は旧名のみで検索しても、残した食品にまとまる', () => {
    const old = { ...chicken, name: '蒸し鶏', protein: 25 };
    const record = buildLogItem('old-log', { ...old, quantity: 4 });
    const date = '2026-09-24';
    const history = {
      [date]: { ...createEmptyDailyLog(date), items: [record] },
    };
    const aliases = {
      [foodCandidateKey(old)]: { foodId: chicken.id, name: old.name },
    };
    expect(searchFoodCandidates([chicken], history, '蒸し鶏', aliases)).toEqual(
      [chicken],
    );
    expect(searchFoodCandidates([chicken], {}, '蒸し鶏', aliases)).toEqual([
      chicken,
    ]);
    expect(record.protein).toBe(100);
  });
});

describe('rankFrequentFoods', () => {
  const item = (
    name: string,
    date: string,
    timestamp: number,
    calories = 100,
  ): FoodItem & { date: string } => ({
    id: `${name}-${timestamp}`,
    name,
    protein: 10,
    fat: 5,
    carbs: 20,
    calories,
    timestamp,
    date,
  });

  it('表記ゆれをまとめて回数順に並べ、最新の記録の内容を使う', () => {
    expect(
      rankFrequentFoods([
        item('サラダチキン', '2026-09-20', 1, 110),
        item('納豆', '2026-09-21', 2),
        item('サラダ チキン', '2026-09-22', 3, 120),
      ]),
    ).toEqual([
      {
        name: 'サラダ チキン',
        store: undefined,
        protein: 10,
        fat: 5,
        carbs: 20,
        calories: 120,
        count: 2,
        lastEatenDate: '2026-09-22',
      },
      expect.objectContaining({ name: '納豆', count: 1 }),
    ]);
  });

  it('記録が新しい順に並んでいなくても最後に食べた日を正しく求める', () => {
    const [food] = rankFrequentFoods([
      item('納豆', '2026-09-22', 3),
      item('納豆', '2026-09-20', 1),
    ]);
    expect(food?.lastEatenDate).toBe('2026-09-22');
  });

  it('同じ回数なら最近食べた物を先にする', () => {
    expect(
      rankFrequentFoods([
        item('納豆', '2026-09-20', 1),
        item('卵', '2026-09-21', 2),
      ]).map((food) => food.name),
    ).toEqual(['卵', '納豆']);
  });
});
