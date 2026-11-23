/** @jest-environment node */
import { askNutrition } from '@/lib/server/nutrition';

// 認証（next-auth）まで読み込まないよう ApiError だけ差し替える
jest.mock('@/lib/api/handler', () => ({ ApiError: Error }));

const FOOD = { name: 'おにぎり', protein: 4, fat: 1, carbs: 40, calories: 190 };

describe('askNutrition', () => {
  const ask = (response: string) =>
    askNutrition([], () => Promise.resolve(response));

  it('応答の食品を整形して返す', async () => {
    await expect(
      ask(JSON.stringify({ ...FOOD, store: 'コンビニ' })),
    ).resolves.toEqual({ ...FOOD, store: 'コンビニ' });
  });

  it('応答が形式どおりでなければエラーにする', async () => {
    await expect(ask('推定できませんでした')).rejects.toThrow(
      'AI の推定結果を読み取れませんでした',
    );
  });

  it('栄養値が全部 0 ならエラーにする', async () => {
    await expect(
      ask(
        JSON.stringify({
          ...FOOD,
          protein: 0,
          fat: 0,
          carbs: 0,
          calories: 0,
          store: '',
        }),
      ),
    ).rejects.toThrow('栄養値を読み取れませんでした');
  });
});
