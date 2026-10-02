import {
  parseMenuListPage,
  parseMenuPage,
  parseNutritionPage,
  type PdfTextItem,
} from '@/lib/catalog/sukiya';

/** 栄養成分一覧 PDF の i 番目の数値の列の見出し（単位）の x。数値はその右に書かれる */
const unitX = (i: number) => 284 + i * 55;

/** 見出しと、y の位置に並ぶ数値の行（[サイズ, kcal, P, F, C, 塩分]）を PDF の文字にする。 */
function page(
  rows: { y: number; size?: string; values: string[] }[],
  labels: PdfTextItem[],
): PdfTextItem[] {
  return [
    { str: '栄養成分について', x: 53, y: 765 },
    ...['(kcal)', '(g)', '(g)', '(g)', '(g)'].map((str, i) => ({
      str,
      x: unitX(i),
      y: 680,
    })),
    ...rows.flatMap((row) => [
      ...(row.size === undefined ? [] : [{ str: row.size, x: 214, y: row.y }]),
      ...row.values.map((str, i) => ({
        str,
        x: unitX(i) + 20,
        y: row.y,
      })),
    ]),
    ...labels,
  ];
}

const gyudonRows = [
  { y: 670, size: 'ミニ', values: ['464', '14.8', '16.0', '65.7', '1.7'] },
  { y: 658, size: '並盛', values: ['695', '21.7', '23.4', '99.8', '2.4'] },
  { y: 646, size: '大盛', values: ['908', '28.4', '30.7', '130.1', '3.1'] },
  { y: 634, values: ['38', '2.4', '1.4', '4.3', '1.5'] },
];

describe('parseNutritionPage', () => {
  it('結合セルのメニュー名・縦書きのカテゴリーを行に割り当て、数値を読み取る', () => {
    expect(
      parseNutritionPage(
        page(gyudonRows, [
          { str: '牛丼', x: 101, y: 658 },
          { str: 'みそ汁', x: 101, y: 634 },
          { str: '牛', x: 67, y: 664 },
          { str: '丼', x: 67, y: 641 },
        ]),
      ),
    ).toEqual([
      {
        category: '牛丼',
        name: '牛丼',
        size: 'ミニ',
        calories: 464,
        protein: 14.8,
        fat: 16,
        carbs: 65.7,
      },
      {
        category: '牛丼',
        name: '牛丼',
        size: '並盛',
        calories: 695,
        protein: 21.7,
        fat: 23.4,
        carbs: 99.8,
      },
      {
        category: '牛丼',
        name: '牛丼',
        size: '大盛',
        calories: 908,
        protein: 28.4,
        fat: 30.7,
        carbs: 130.1,
      },
      {
        category: '牛丼',
        name: 'みそ汁',
        calories: 38,
        protein: 2.4,
        fat: 1.4,
        carbs: 4.3,
      },
    ]);
  });

  it('同じ行で分かれたメニュー名はつなげ、全角は半角に揃える', () => {
    const rows = parseNutritionPage(
      page(
        [{ y: 670, size: 'Ｍ', values: ['252', '5.0', '9.2', '37.4', '0.3'] }],
        [
          { str: 'Sukiシェイク', x: 101, y: 670 },
          { str: 'バニラ', x: 164, y: 670 },
          { str: 'ドリンク', x: 55, y: 670 },
        ],
      ),
    );
    expect(rows[0]).toMatchObject({ name: 'Sukiシェイク バニラ', size: 'M' });
  });

  it('数値が欠けた行があれば例外にする', () => {
    const rows = [
      { y: 670, size: '並盛', values: ['695', '21.7', '23.4', '99.8'] },
    ];
    expect(() =>
      parseNutritionPage(
        page(rows, [
          { str: '牛丼', x: 101, y: 670 },
          { str: '牛丼', x: 55, y: 670 },
        ]),
      ),
    ).toThrow('栄養成分の行が読み取れません');
  });

  it('メニュー名の割り当たらない行があれば例外にする', () => {
    expect(() =>
      parseNutritionPage(
        page(gyudonRows, [
          { str: '牛丼', x: 101, y: 658 },
          { str: '牛', x: 67, y: 664 },
          { str: '丼', x: 67, y: 641 },
        ]),
      ),
    ).toThrow('メニューの無い行があります');
  });

  it('見出しが無ければ例外にする', () => {
    expect(() => parseNutritionPage([{ str: '牛丼', x: 101, y: 600 }])).toThrow(
      '栄養成分の見出しが読み取れません',
    );
  });
});

describe('parseMenuListPage', () => {
  it('商品ページの URL を重複なく返す', () => {
    expect(
      parseMenuListPage(`
        <a href="/menu/in/gyudon/100100/index.html">a</a>
        <a href="/menu/in/gyudon/100100/index.html">a</a>
        <a href="/menu/in/side/701200/index.html">b</a>
        <a href="/menu/in/gyudon/">一覧</a>`),
    ).toEqual([
      'https://www.sukiya.jp/menu/in/gyudon/100100/index.html',
      'https://www.sukiya.jp/menu/in/side/701200/index.html',
    ]);
  });
});

describe('parseMenuPage', () => {
  const size = (label: string, price: string) => `
    <li class="pro_page_size_li amount01">
      <div class="size">
        ${label}      </div>
      <div class="price">
        <span>${price}</span>円
      </div>
    </li>`;

  it('商品名とサイズごとの価格を読み取り、コメントアウトされた価格表は無視する', () => {
    expect(
      parseMenuPage(`
        <h2 class="pro_page_title media_pc">
          とろ〜り３種の<br>チーズ牛丼     </h2>
        <!-- <ul>${size('ミニ', '660')}</ul> -->
        <ul class="pro_page_size_list">${size('ミニ', '630')}${size('並盛', '690')}</ul>`),
    ).toEqual({
      name: 'とろ〜り3種のチーズ牛丼',
      prices: [
        { size: 'ミニ', price: 630 },
        { size: '並盛', price: 690 },
      ],
    });
  });

  it('商品名が無ければ例外にする', () => {
    expect(() => parseMenuPage(size('並盛', '480'))).toThrow(
      '商品名が読み取れません',
    );
  });
});
