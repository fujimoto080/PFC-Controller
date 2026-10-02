import { MARUCHAN_CATEGORIES, parseProductList } from '@/lib/catalog/maruchan';

/** 商品検索 API の商品。必要な項目だけ。 */
function product(overrides: Record<string, unknown> = {}) {
  return {
    product_code: '206158',
    product_name: '赤いきつねうどん　東',
    product_price: '248',
    product_jancode: '4901990522731',
    product_amount: '96g(めん74g)',
    unit_quantity: '1食(96g)当たり',
    product_salesarea: '東北・信越・関東・静岡・中京',
    searchword_nutorition:
      'エネルギー:412.000kcal\n　めん・かやく:390.000kcal\n　スープ:22.000kcal\nたん白質:9.900g\n脂質:18.000g\n炭水化物:52.600g\n食塩相当量:5.800g\n　めん・かやく:2.300g\n　スープ:3.500g',
    link_pc:
      'https://www.maruchan.co.jp/products/search/akaikitsuneudon_higashi.html',
    ...overrides,
  };
}

const parse = (products: Record<string, unknown>[]) =>
  parseProductList(JSON.stringify({ result: 1, output: products }), 'cup');

describe('MARUCHAN_CATEGORIES', () => {
  it('カップ麺・袋麺・パックご飯は主食、スープは副菜', () => {
    expect(MARUCHAN_CATEGORIES.map(({ slug, role }) => [slug, role])).toEqual([
      ['instant-cupnoodles', 'main'],
      ['instant-noodles', 'main'],
      ['cooked-rice', 'main'],
      ['soup', 'side'],
    ]);
  });
});

describe('parseProductList', () => {
  it('商品名・税込価格・販売エリア・1食分の合計の栄養成分・商品ページの URL を読み取る', () => {
    expect(parse([product()])).toEqual([
      {
        id: '206158',
        name: '赤いきつねうどん 東',
        category: 'cup',
        price: 268,
        area: '東北・信越・関東・静岡・中京',
        url: 'https://www.maruchan.co.jp/products/search/akaikitsuneudon_higashi.html',
        calories: 412,
        protein: 9.9,
        fat: 18,
        carbs: 52.6,
        jans: ['4901990522731'],
      },
    ]);
  });

  it('JAN コードが空の商品は jans を持たない', () => {
    expect(parse([product({ product_jancode: '' })])[0]).not.toHaveProperty(
      'jans',
    );
  });

  it('JAN コードが数字 8 桁か 13 桁でなければ例外にする', () => {
    for (const jan of ['490199052273', '49019905227AB', 4901990522731]) {
      expect(() => parse([product({ product_jancode: jan })])).toThrow(
        'JAN コードが読み取れません',
      );
    }
  });

  it('全国の商品は販売エリアを持たず、全角空白や単位前の空白がある栄養成分も読む', () => {
    const [item] = parse([
      product({
        product_salesarea: '全国',
        searchword_nutorition:
          'エネルギー:　292kcal\nたん白質:　4.4g\n脂質:　1.0g\n炭水化物:66.4 g\nナトリウム:0mg',
      }),
    ]);
    expect(item).not.toHaveProperty('area');
    expect(item).toMatchObject({
      calories: 292,
      protein: 4.4,
      fat: 1,
      carbs: 66.4,
    });
  });

  it('希望小売価格が数字でないオープン価格の商品は価格を持たない', () => {
    const [item] = parse([product({ product_price: '' })]);
    expect(item).not.toHaveProperty('price');
  });

  it('関東で買えない商品・栄養成分の無い商品・複数食入りのパックは除く', () => {
    expect(
      parse([
        product({ product_code: '1', product_salesarea: '近畿' }),
        product({ product_code: '2', searchword_nutorition: '' }),
        product({
          product_code: '3',
          product_amount: '96g(めん74g)×5食',
        }),
        product({
          product_code: '4',
          product_amount: '600g(200g×3)',
          unit_quantity: '1パック(200g)当たり',
        }),
        product({
          product_code: '5',
          product_salesarea: '名古屋以東(北陸含む)',
        }),
      ]).map((item) => item.id),
    ).toEqual(['5']);
  });

  it('栄養成分が載っているのに読めなければ例外にする', () => {
    expect(() =>
      parse([product({ searchword_nutorition: 'エネルギー:412.000kcal' })]),
    ).toThrow('たん白質');
  });

  it('商品の一覧が無ければ例外にする', () => {
    expect(() => parseProductList('{"result":0}', 'cup')).toThrow(
      '商品の一覧が読み取れません',
    );
  });

  it('商品の項目が文字列でなければ例外にする', () => {
    expect(() => parse([product({ product_amount: null })])).toThrow(
      'product_amount',
    );
  });
});
