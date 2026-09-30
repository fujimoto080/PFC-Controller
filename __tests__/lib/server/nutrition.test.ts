/** @jest-environment node */
import { askNutrition, readNutritionImage } from '@/lib/server/nutrition';

// 認証（next-auth）まで読み込まないよう ApiError だけ差し替える
jest.mock('@/lib/api/handler', () => ({ ApiError: Error }));

const FOOD = { name: 'おにぎり', protein: 4, fat: 1, carbs: 40, calories: 190 };

// AI が答える 1 件分（確認用の evidence・確かさ付き）
const ANSWER = {
  evidence: '1個あたりの表示を読み取った',
  confidence: 'medium',
  ...FOOD,
  store: '',
};

const read = (response: string, multiple: boolean) =>
  readNutritionImage([], multiple, () => Promise.resolve(response));

describe('readNutritionImage', () => {
  it('1 件の読み取りで食品・確かさと応答をそのまま返し、evidence は食品に含めない', async () => {
    const response = JSON.stringify(ANSWER);
    await expect(read(response, false)).resolves.toEqual({
      foods: [{ food: { ...FOOD, store: undefined }, confidence: 'medium' }],
      response,
    });
  });

  it('複数件の読み取りで栄養値が全部 0 の商品を除く', async () => {
    const response = JSON.stringify({
      foods: [
        ANSWER,
        { ...ANSWER, name: '不明', protein: 0, fat: 0, carbs: 0, calories: 0 },
      ],
    });
    const { foods } = await read(response, true);
    expect(foods.map(({ food }) => food.name)).toEqual(['おにぎり']);
  });

  it('応答が形式どおりでなければエラーにせず応答を返す', async () => {
    const invalid = [
      '読み取れませんでした',
      '{"carbs":7.2+5.4}',
      JSON.stringify({ ...ANSWER, confidence: 'sure' }),
    ];
    for (const response of invalid) {
      await expect(read(response, false)).resolves.toEqual({
        foods: [],
        response,
      });
    }
    await expect(read('{"foods": "none"}', true)).resolves.toEqual({
      foods: [],
      response: '{"foods": "none"}',
    });
  });
});

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
