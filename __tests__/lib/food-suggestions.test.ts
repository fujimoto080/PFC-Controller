import {
  getSimilarFoodSuggestions,
  searchFoodCandidates,
} from '@/lib/food-suggestions';
import { createEmptyDailyLog, type FoodItem, type Logs } from '@/lib/types';

const foods: FoodItem[] = [
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

describe('getSimilarFoodSuggestions', () => {
  it('入力が短すぎる場合は候補を返さない', () => {
    expect(getSimilarFoodSuggestions(foods, 'サ')).toEqual([]);
  });

  it('名前が似ている食品を優先して返す', () => {
    const suggestions = getSimilarFoodSuggestions(foods, 'サラダチキ');
    expect(suggestions.map((item) => item.id)).toEqual(['1', '2']);
  });

  it('区切り文字が異なる食品名でも候補に含む', () => {
    const suggestions = getSimilarFoodSuggestions(foods, 'サラダチキンバジル');
    expect(suggestions[0]?.id).toBe('2');
  });
});

describe('searchFoodCandidates', () => {
  const eaten = (id: string, timestamp: number, food: FoodItem): FoodItem => ({
    ...food,
    id,
    timestamp,
  });
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
      searchFoodCandidates(foods, logs, '').map((food) => food.id),
    ).toEqual(['log-2', 'log-3', '2']);
  });

  it('区切り文字を無視して食品名に検索語を含むものに絞る', () => {
    expect(
      searchFoodCandidates(foods, logs, 'チキン バジル').map((food) => food.id),
    ).toEqual([basil.id]);
  });
});
