/** @jest-environment node */
import { findOpenFoodFactsByBarcode } from '@/lib/server/open-food-facts';

jest.mock('server-only', () => ({}));

const fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>();
global.fetch = fetchMock as unknown as typeof fetch;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const found = (nutriments: Record<string, number>) =>
  json({
    status: 1,
    product: {
      product_name: 'ヨーグルト',
      brands: 'メーカー,別名',
      nutriments,
    },
  });

beforeEach(() => fetchMock.mockReset());

describe('findOpenFoodFactsByBarcode', () => {
  it('1 食分の栄養値があればそれを使う', async () => {
    fetchMock.mockResolvedValueOnce(
      found({
        'energy-kcal_serving': 80.04,
        proteins_serving: 4.25,
        fat_serving: 3,
        carbohydrates_serving: 9,
        'energy-kcal_100g': 1,
        proteins_100g: 1,
        fat_100g: 1,
        carbohydrates_100g: 1,
      }),
    );
    expect(await findOpenFoodFactsByBarcode('4901234567894')).toEqual({
      name: 'ヨーグルト',
      store: 'メーカー',
      calories: 80,
      protein: 4.3,
      fat: 3,
      carbs: 9,
    });
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/4901234567894.json');
  });

  it('100g あたりしか無いときは名前に (100g) を付ける', async () => {
    fetchMock.mockResolvedValueOnce(
      found({
        'energy-kcal_100g': 60,
        proteins_100g: 3,
        fat_100g: 2,
        carbohydrates_100g: 7,
      }),
    );
    expect(await findOpenFoodFactsByBarcode('1')).toMatchObject({
      name: 'ヨーグルト (100g)',
      calories: 60,
    });
  });

  it('栄養値が揃っていなければ null', async () => {
    fetchMock.mockResolvedValueOnce(found({ proteins_100g: 3 }));
    expect(await findOpenFoodFactsByBarcode('1')).toBeNull();
  });

  it('商品が無ければ null', async () => {
    fetchMock.mockResolvedValueOnce(json({ status: 0 }));
    expect(await findOpenFoodFactsByBarcode('1')).toBeNull();
  });

  it('API エラーは例外にする', async () => {
    fetchMock.mockResolvedValueOnce(json({}, 500));
    await expect(findOpenFoodFactsByBarcode('1')).rejects.toThrow('500');
  });
});
