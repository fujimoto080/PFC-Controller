import { withoutSharedJans } from '@/lib/catalog/scrape';
import type { CatalogItem } from '@/lib/catalog/types';

function item(id: string, jans?: string[]): CatalogItem {
  return {
    id,
    name: id,
    category: 'c',
    url: 'https://example.com',
    calories: 1,
    protein: 1,
    fat: 1,
    carbs: 1,
    ...(jans && { jans }),
  };
}

describe('withoutSharedJans', () => {
  it('複数の商品に出る JAN は該当商品すべてから外し、他の JAN は残す', () => {
    const result = withoutSharedJans([
      item('a', ['4902881454131']),
      item('b', ['4902881454131']),
      item('c', ['4902881435161', '4902881454131']),
      item('d'),
    ]);
    expect(result.map(({ jans }) => jans)).toEqual([
      undefined,
      undefined,
      ['4902881435161'],
      undefined,
    ]);
    expect(result[0]).not.toHaveProperty('jans');
  });
});
