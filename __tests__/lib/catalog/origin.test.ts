import { ORIGIN_CATEGORIES, parseMenuPage } from '@/lib/catalog/origin';

/** 公式サイトのメニューの商品。必要な項目だけ。 */
function menu(overrides: Record<string, unknown> = {}) {
  return {
    uniqueId: '12ws220fh-3xcxfu',
    productCode: '107382',
    region: 'east',
    salesUnit: 'piece',
    price: 490,
    priceWithTax: 529.2,
    energy: 641,
    protein: 21.6,
    fat: 23.8,
    carbohydrates: 80.8,
    translations: [
      {
        lang: 'ja',
        productName: 'スマイル！ロースとんかつ弁当',
        productNameSub: '',
      },
      { lang: 'en', productName: 'Smiley! Pork loin cutlet bento' },
    ],
    ...overrides,
  };
}

/**
 * メニューページの HTML。商品の一覧は Next.js の RSC ペイロードとして
 * self.__next_f.push([1, "..."]) の文字列に分かれて埋め込まれている。
 */
function menuPage(menus: Record<string, unknown[]>) {
  const menusByCategory = ORIGIN_CATEGORIES.map(({ slug }) => ({
    key: slug,
    menus: menus[slug] ?? [menu({ productCode: slug })],
  }));
  const row = `7:["$","div",null,{"children":["$","$L8",null,${JSON.stringify({
    menusByCategory,
    locale: 'ja',
  })}]}]\n`;
  const middle = Math.floor(row.length / 2);
  return [
    '0:{"b":"build"}\n',
    row.slice(0, middle),
    row.slice(middle),
    '9:T12,<p>説明文</p>\n',
  ]
    .map(
      (chunk) =>
        `<script>self.__next_f.push([1,${JSON.stringify(chunk)}])</script>`,
    )
    .join('');
}

const findItem = (html: string, id: string) =>
  parseMenuPage(html).find((item) => item.id === id);

describe('parseMenuPage', () => {
  it('商品名・税込価格・栄養成分・商品ページの URL を読み取る', () => {
    expect(
      findItem(menuPage({ freshly_made_bento: [menu()] }), '107382'),
    ).toEqual({
      id: '107382',
      name: 'スマイル!ロースとんかつ弁当',
      category: 'freshly_made_bento',
      price: 529,
      url: 'https://kitchen-origin.toshu.co.jp/detail12ws220fh-3xcxfu',
      calories: 641,
      protein: 21.6,
      fat: 23.8,
      carbs: 80.8,
    });
  });

  it('副題を名前に含め、量り売りは 100g あたりと分かる名前にする', () => {
    const html = menuPage({
      prepared_foods: [
        menu({
          productCode: '28151',
          salesUnit: 'g100',
          translations: [
            {
              lang: 'ja',
              productName: '揚げ出し豆腐',
              productNameSub: '～和風みぞれ～（2個）',
            },
          ],
        }),
      ],
    });
    expect(findItem(html, '28151')?.name).toBe(
      '揚げ出し豆腐 ~和風みぞれ~(2個)(100gあたり)',
    );
  });

  it('関東以外・栄養成分の無い商品・予約専用・単位の分からない商品は除く', () => {
    const html = menuPage({
      freshly_made_bento: [
        menu(),
        menu({ productCode: 'west', region: 'west' }),
        menu({
          productCode: 'no-nutrition',
          energy: null,
          protein: null,
          fat: null,
          carbohydrates: null,
        }),
        menu({
          productCode: 'reservation',
          translations: [
            {
              lang: 'ja',
              productName: '【ご予約専用】満彩ご膳',
              productNameSub: '',
            },
          ],
        }),
        menu({ productCode: 'gram', salesUnit: 'g' }),
      ],
    });
    expect(
      parseMenuPage(html)
        .filter((item) => item.category === 'freshly_made_bento')
        .map((item) => item.id),
    ).toEqual(['107382']);
  });

  it('栄養成分が載っているのに読めなければ例外にする', () => {
    expect(() =>
      parseMenuPage(menuPage({ salads: [menu({ protein: null })] })),
    ).toThrow('スマイル!ロースとんかつ弁当 のたんぱく質が読み取れません');
  });

  it('メニューの一覧が無ければ例外にする', () => {
    expect(() => parseMenuPage('<html></html>')).toThrow(
      'メニューの一覧が読み取れません',
    );
  });
});
