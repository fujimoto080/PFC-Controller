import { parseCategoryMenus } from '@/lib/catalog/mos';

const nutrition = (energy: string) => [
  { name: '重量', quantity: '211.2g', group: null },
  { name: 'エネルギー', quantity: energy, group: null },
  { name: 'たんぱく質', quantity: '15.2g', group: null },
  { name: '脂質', quantity: '17.0g', group: null },
  { name: '炭水化物', quantity: '40.0g', group: null },
];

/** 公式サイトの商品。必要な項目だけ。 */
function menu(overrides: Record<string, unknown> = {}) {
  return {
    id: '010320',
    name: 'モスバーガー',
    price: 500,
    nutrition: nutrition('372kcal'),
    ...overrides,
  };
}

const parse = (menus: unknown[], category = '1') =>
  parseCategoryMenus(JSON.stringify(menus), category);

describe('parseCategoryMenus', () => {
  it('商品名・税込価格・栄養成分・商品ページの URL を読み取る', () => {
    expect(parse([menu()])).toEqual([
      {
        id: '010320',
        name: 'モスバーガー',
        category: '1',
        price: 500,
        url: 'https://www.mos.jp/menu/detail/?menu_id=010320&c_id=1',
        calories: 372,
        protein: 15.2,
        fat: 17,
        carbs: 40,
      },
    ]);
  });

  it('サイズ違いの商品はサイズごとに別商品にする', () => {
    const items = parse(
      [
        menu({
          id: 'P00015',
          name: 'フレンチフライポテト',
          price: 290,
          nutrition: undefined,
          group: {
            '1': {
              menu_id: '210001',
              size: 1,
              price: 290,
              nutrition: nutrition('170kcal'),
            },
            '2': {
              menu_id: '210090',
              size: 2,
              price: 340,
              nutrition: nutrition('238kcal'),
            },
          },
        }),
      ],
      '7',
    );
    expect(items.map((i) => [i.id, i.name, i.price, i.calories])).toEqual([
      ['210001', 'フレンチフライポテト S', 290, 170],
      ['210090', 'フレンチフライポテト M', 340, 238],
    ]);
    expect(items[0]?.url).toBe(
      'https://www.mos.jp/menu/detail/?menu_id=P00015&c_id=7',
    );
  });

  it('価格が無い商品は価格を省く', () => {
    const [item] = parse([menu({ price: null })]);
    expect(item).toBeDefined();
    expect(item).not.toHaveProperty('price');
  });

  it('栄養成分が載っていない商品、別添のソースやパックは除く', () => {
    expect(
      parse([
        menu({ id: '1', name: 'まぜるシェイク', nutrition: undefined }),
        menu({ id: '2', name: 'バーベキューソース' }),
        menu({ id: '3', name: 'モスチキンパック 5本入り' }),
        menu({
          id: '4',
          name: 'こだわりサラダ 和風ドレッシング＜減塩タイプ＞',
        }),
      ]).map((i) => i.id),
    ).toEqual(['4']);
  });

  it('栄養成分があるのに読めなければ例外にする', () => {
    expect(() => parse([menu({ nutrition: nutrition('不明') })])).toThrow(
      'モスバーガー のエネルギーが読み取れません',
    );
    expect(() => parse([menu({ nutrition: [] })])).toThrow(
      'モスバーガー のエネルギーが読み取れません',
    );
  });

  it('商品の配列でなければ例外にする', () => {
    expect(() => parseCategoryMenus('{}', '1')).toThrow(
      'メニューの一覧が読み取れません',
    );
  });
});
