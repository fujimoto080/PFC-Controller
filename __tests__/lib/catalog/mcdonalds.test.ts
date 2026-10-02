import {
  parseMenuListPage,
  parseNutritionPage,
  parsePrice,
  selectMenuItems,
} from '@/lib/catalog/mcdonalds';

/** 栄養情報一覧の1行。values は エネルギー・たんぱく質・脂質・飽和脂肪酸・炭水化物・糖類・食塩相当量。 */
function row(id: string, name: string, values: string[], kind = 'バーガー') {
  return `<tr data-kind='${kind}'>
<td class='p-2'>
<a href='/products/${id}/' class='font-normal'>${name}</a>
</td>
${values.map((v) => `<td>${v}</td>`).join('\n')}
<td></td>
</tr>`;
}

const bigMac = ['524', '26.1', '28.0', '10.77', '42.0', '8', '2.7'];

const nutritionPage = (rows: string[]) =>
  `<table class='allergy-info__table js-allergy-info__table allergy-info__table--second'>
<thead><tr><th>商品名</th></tr></thead>
<tbody>${rows.join('\n')}</tbody>
</table>`;

const menuCard = (name: string) =>
  `<strong class='product-list-card-name font-bold mt-2 mb-2 mb-4:md'>${name}</strong>`;

const priceBlock = (prices: Record<string, string>) =>
  Object.entries(prices)
    .map(
      ([label, price]) => `<div class='flex items-baseline mr-4 my-4'>
<span class='font-semibold pdp__product-info-quantity'>${label}</span>
<span class='font-bold product-section-price-primary-symbol mr-1'>¥</span>
<span class='font-speedee font-bold product-section-price-primary-val'>${price}</span>
</div>`,
    )
    .join('\n');

describe('parseNutritionPage', () => {
  it('商品ごとの商品番号・名前・栄養成分を読み取る', () => {
    expect(
      parseNutritionPage(
        nutritionPage([
          row('1210', 'ビッグマック®', bigMac),
          row('2020', 'マックフライポテト®(M)', [
            '410',
            '5.5',
            '20.0',
            '7.51',
            '52.4',
            '0',
            '0.8',
          ]),
        ]),
      ),
    ).toEqual([
      {
        id: '1210',
        name: 'ビッグマック®',
        calories: 524,
        protein: 26.1,
        fat: 28,
        carbs: 42,
      },
      {
        id: '2020',
        name: 'マックフライポテト®(M)',
        calories: 410,
        protein: 5.5,
        fat: 20,
        carbs: 52.4,
      },
    ]);
  });

  it('エネルギーが空の商品は栄養成分が載っていないので除く', () => {
    const empty = ['', '', '', '', '', '', ''];
    expect(
      parseNutritionPage(
        nutritionPage([
          row('1', '栄養成分の無い商品', empty),
          row('1210', 'ビッグマック®', bigMac),
        ]),
      ).map((r) => r.id),
    ).toEqual(['1210']);
  });

  it('栄養成分が載っているのに数値でなければ例外にする', () => {
    expect(() =>
      parseNutritionPage(
        nutritionPage([
          row('1210', 'ビッグマック®', ['524', '-', '28.0', '10.77', '42.0']),
        ]),
      ),
    ).toThrow('ビッグマック® のたんぱく質が読み取れません');
  });

  it('栄養情報の表や商品ページへのリンクが無ければ例外にする', () => {
    expect(() => parseNutritionPage('<p>メンテナンス中</p>')).toThrow(
      '栄養情報の表が読み取れません',
    );
    expect(() => parseNutritionPage(nutritionPage([]))).toThrow(
      '栄養情報の行が読み取れません',
    );
    expect(() =>
      parseNutritionPage(
        nutritionPage([`<tr data-kind='バーガー'><td>名前だけ</td></tr>`]),
      ),
    ).toThrow('商品ページへのリンクが読み取れません');
  });
});

describe('parseMenuListPage', () => {
  it('商品名を表記ゆれ（異体字セレクタ）を揃えて読み取る', () => {
    expect(
      parseMenuListPage(menuCard('マックチキン®️') + menuCard('ビッグマック®')),
    ).toEqual(['マックチキン®', 'ビッグマック®']);
  });

  it('商品が1つも読めなければ例外にする', () => {
    expect(() => parseMenuListPage('<p>メンテナンス中</p>')).toThrow(
      'メニューの商品が読み取れません',
    );
  });
});

describe('parsePrice', () => {
  it('単品の価格から「~」を除いた数字を読む', () => {
    expect(parsePrice(priceBlock({ 単品: '500~' }), undefined)).toBe(500);
  });

  it('サイズ違いはサイズの見出しの価格を読む', () => {
    const html = priceBlock({
      Sサイズ: '220~',
      Mサイズ: '350~',
      Lサイズ: '400~',
    });
    expect(parsePrice(html, 'M')).toBe(350);
  });

  it('価格が載っていなければ undefined', () => {
    expect(parsePrice('<p>価格なし</p>', undefined)).toBeUndefined();
    expect(parsePrice(priceBlock({ 単品: '500~' }), 'S')).toBeUndefined();
  });
});

describe('selectMenuItems', () => {
  const nutrition = (id: string, name: string) => ({
    id,
    name,
    calories: 1,
    protein: 1,
    fat: 1,
    carbs: 1,
  });

  it('メニューページに載っている商品をカテゴリとサイズ付きで選び、載っていない物は除く', () => {
    const items = selectMenuItems(
      [
        nutrition('1210', 'ビッグマック®'),
        nutrition('2020', 'マックフライポテト®(M)'),
        nutrition('8502', 'バターパット'),
      ],
      { burger: ['ビッグマック®'], side: ['マックフライポテト®'] },
    );
    expect(
      items.map(({ id, category, size }) => ({ id, category, size })),
    ).toEqual([
      { id: '1210', category: 'burger', size: undefined },
      { id: '2020', category: 'side', size: 'M' },
    ]);
  });

  it('サイドメニューに載っていてもソースとパイは副菜にしない', () => {
    expect(
      selectMenuItems(
        [
          nutrition('1612', 'マスタードソース'),
          nutrition('6960', '月見パイ'),
          nutrition('2200', 'サイドサラダ'),
        ],
        { burger: [], side: ['マスタードソース', '月見パイ', 'サイドサラダ'] },
      ).map((i) => i.id),
    ).toEqual(['2200']);
  });
});
