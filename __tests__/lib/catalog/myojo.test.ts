import {
  MYOJO_CATEGORIES,
  parseProductDetail,
  parseProductIds,
} from '@/lib/catalog/myojo';

/** 商品の詳細 API の応答。必要な項目だけ。栄養成分の並びは商品によって違う。 */
function detail(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    id: 13947,
    name: '明星 チャルメラカップ しょうゆ',
    price: '252',
    jan: '4902881435161',
    number_of_products: '',
    sales_area: '全国',
    nutrition_label: '栄養成分表示　[1食 (68g) 当たり]',
    nutrition: [
      { name: '脂質', amount: '11.9g' },
      {
        name: '熱量',
        amount: '306kcal',
        child: [
          { name: 'めん・かやく', amount: '291kcal' },
          { name: 'スープ', amount: '15kcal' },
        ],
      },
      { name: 'たんぱく質', amount: '6.6g' },
      { name: '炭水化物', amount: '43.2g' },
      { name: 'ビタミンB1', amount: '0.31mg' },
    ],
    ...overrides,
  });
}

describe('MYOJO_CATEGORIES', () => {
  it('麺類は主食、スープは副菜', () => {
    expect(MYOJO_CATEGORIES.map(({ slug, role }) => [slug, role])).toEqual([
      ['regular', 'main'],
      ['big', 'main'],
      ['yakisoba', 'main'],
      ['yakisoba_big', 'main'],
      ['noodle', 'main'],
      ['soup', 'side'],
    ]);
  });
});

describe('parseProductIds', () => {
  it('商品一覧 API の応答から商品番号を読み取る', () => {
    expect(
      parseProductIds(JSON.stringify({ products: [{ id: 13991 }, { id: 8 }] })),
    ).toEqual(['13991', '8']);
  });

  it('商品が空なら空の配列', () => {
    expect(parseProductIds(JSON.stringify({ products: [] }))).toEqual([]);
  });

  it('形が違えば例外にする', () => {
    expect(() => parseProductIds('{}')).toThrow('商品の一覧が読み取れません');
    expect(() =>
      parseProductIds(JSON.stringify({ products: [{ id: 'x' }] })),
    ).toThrow('商品の id が読み取れません');
  });
});

describe('parseProductDetail', () => {
  it('1 食分の合計の栄養成分と税込価格・商品ページの URL を読み取る', () => {
    expect(parseProductDetail(detail(), 'regular')).toEqual({
      id: '13947',
      name: '明星 チャルメラカップ しょうゆ',
      category: 'regular',
      price: 272,
      url: 'https://www.myojofoods.co.jp/products/items/13947/',
      jans: ['4902881435161'],
      calories: 306,
      protein: 6.6,
      fat: 11.9,
      carbs: 43.2,
    });
  });

  it('複数食入りは栄養成分を 1 食分で読み、価格は省く', () => {
    const item = parseProductDetail(
      detail({ price: '730', number_of_products: '５' }),
      'noodle',
    );
    expect(item).toMatchObject({ calories: 306 });
    expect(item).not.toHaveProperty('price');
  });

  it('JAN コードが空なら jans を省く', () => {
    expect(
      parseProductDetail(detail({ jan: '' }), 'regular'),
    ).not.toHaveProperty('jans');
  });

  it('JAN コードが 8 桁・13 桁の数字でなければ例外にする', () => {
    for (const jan of ['49028814351', '490288143516a', '4902881435161 / 2']) {
      expect(() => parseProductDetail(detail({ jan }), 'regular')).toThrow(
        'JAN コードが読み取れません',
      );
    }
  });

  it('オープンプライスは価格を省く', () => {
    const item = parseProductDetail(
      detail({ price: 'オープンプライス' }),
      'noodle',
    );
    expect(item).not.toHaveProperty('price');
  });

  it('全国以外の関東で買える販売エリアは地域を残す', () => {
    expect(
      parseProductDetail(detail({ sales_area: '東日本' }), 'regular'),
    ).toMatchObject({ area: '東日本' });
  });

  it('関東で買えない販売エリアの商品は除く', () => {
    for (const area of ['中四国', '九州・沖縄', '沖縄']) {
      expect(
        parseProductDetail(detail({ sales_area: area }), 'regular'),
      ).toBeUndefined();
    }
  });

  it('栄養成分が載っていない商品は除く', () => {
    expect(
      parseProductDetail(detail({ nutrition: [] }), 'regular'),
    ).toBeUndefined();
  });

  it('栄養成分の単位が 1 食でなければ例外にする', () => {
    expect(() =>
      parseProductDetail(
        detail({ nutrition_label: '栄養成分表示　[100g 当たり]' }),
        'regular',
      ),
    ).toThrow('栄養成分の単位が読み取れません');
  });

  it('栄養成分の項目が無ければ例外にする', () => {
    expect(() =>
      parseProductDetail(
        detail({ nutrition: [{ name: '熱量', amount: '306kcal' }] }),
        'regular',
      ),
    ).toThrow('たんぱく質が読み取れません');
  });

  it('形が違えば例外にする', () => {
    expect(() => parseProductDetail(detail({ price: 252 }), 'regular')).toThrow(
      '商品の price が読み取れません',
    );
    expect(() =>
      parseProductDetail(detail({ nutrition: null }), 'regular'),
    ).toThrow('商品の nutrition が読み取れません');
  });
});
