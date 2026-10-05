/** @jest-environment node */
import { searchCatalogFoods } from '@/lib/server/catalog-search';
import { searchKaloriFoods } from '@/lib/server/kalori';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/server/kalori', () => ({ searchKaloriFoods: jest.fn() }));

const searchKalori = jest.mocked(searchKaloriFoods);

beforeEach(() => {
  searchKalori.mockReset();
});

describe('searchCatalogFoods', () => {
  it('公式サイトのカタログに当たれば Kalori は引かない', async () => {
    const result = await searchCatalogFoods('user-1', '牛めし');
    expect(result.source).toBe('catalog');
    expect(result.foods.length).toBeGreaterThan(0);
    expect(result.foods.every((food) => food.store !== undefined)).toBe(true);
    expect(searchKalori).not.toHaveBeenCalled();
  });

  it('カタログに無ければ Kalori の結果を返す', async () => {
    const foods = [
      {
        name: 'ニューデイズの商品',
        calories: 100,
        protein: 1,
        fat: 2,
        carbs: 3,
      },
    ];
    searchKalori.mockResolvedValueOnce(foods);
    await expect(
      searchCatalogFoods('user-1', 'zzz存在しない商品名zzz'),
    ).resolves.toEqual({ source: 'kalori', foods });
    expect(searchKalori).toHaveBeenCalledWith(
      'user-1',
      'zzz存在しない商品名zzz',
    );
  });

  it('Kalori に連携していなければ空を返す', async () => {
    searchKalori.mockResolvedValueOnce(undefined);
    await expect(
      searchCatalogFoods('user-1', 'zzz存在しない商品名zzz'),
    ).resolves.toEqual({ source: 'kalori', foods: [] });
  });
});
