import { getSimilarFoodSuggestions } from '@/lib/food-suggestions';
import { FoodItem } from '@/lib/types';

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
