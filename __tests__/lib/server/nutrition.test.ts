/** @jest-environment node */
import { readNutritionImage } from '@/lib/server/nutrition';

// 認証（next-auth）まで読み込まないよう ApiError だけ差し替える
jest.mock('@/lib/api/handler', () => ({ ApiError: Error }));

const FOOD = { name: 'おにぎり', protein: 4, fat: 1, carbs: 40, calories: 190 };

const read = (response: string, multiple: boolean) =>
  readNutritionImage([], multiple, () => Promise.resolve(response));

describe('readNutritionImage', () => {
  it('1 件の読み取りで食品と応答をそのまま返す', async () => {
    const response = JSON.stringify({ ...FOOD, store: '' });
    await expect(read(response, false)).resolves.toEqual({
      foods: [{ ...FOOD, store: undefined }],
      response,
    });
  });

  it('複数件の読み取りで栄養値が全部 0 の商品を除く', async () => {
    const response = `\`\`\`json\n${JSON.stringify({
      foods: [
        FOOD,
        { name: '不明', protein: 0, fat: 0, carbs: 0, calories: 0 },
      ],
    })}\n\`\`\``;
    const { foods } = await read(response, true);
    expect(foods.map((food) => food.name)).toEqual(['おにぎり']);
  });

  it('応答を解釈できなくてもエラーにせず応答を返す', async () => {
    await expect(read('読み取れませんでした', false)).resolves.toEqual({
      foods: [],
      response: '読み取れませんでした',
    });
    await expect(read('{"foods": "none"}', true)).resolves.toEqual({
      foods: [],
      response: '{"foods": "none"}',
    });
  });
});
