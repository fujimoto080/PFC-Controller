import type { PdfTextItem } from '@/lib/catalog/pdf';
import {
  parseMenuListPage,
  parseMenuPage,
  parseNutritionPage,
} from '@/lib/catalog/yoshinoya';

/** 栄養成分一覧 PDF の見出し（単位）の x。数値はその右に書かれる */
const UNIT_XS = [618, 728, 826, 924, 1022];

/** 日本語の表の見出し（「メニュー」と単位）と、y の位置に並ぶ数値の行（[kcal, P, F, C, 塩分]）を PDF の文字にする。 */
function page(
  rows: { y: number; size?: string; values: string[] }[],
  labels: PdfTextItem[],
): PdfTextItem[] {
  return [
    { str: '吉野家メニュー情報', x: 180, y: 3175 },
    { str: 'メニュー', x: 274, y: 2949 },
    ...['（kcaｌ）', '（ｇ）', '（ｇ）', '（ｇ）', '（ｇ）'].map((str, i) => ({
      str,
      x: UNIT_XS[i] ?? 0,
      y: 2838,
    })),
    ...rows.flatMap((row) => [
      ...(row.size === undefined ? [] : [{ str: row.size, x: 537, y: row.y }]),
      ...row.values.map((str, i) => ({
        str,
        x: (UNIT_XS[i] ?? 0) + 25,
        y: row.y,
      })),
    ]),
    ...labels,
  ];
}

const gyudonRows = [
  { y: 2800, size: '小盛', values: ['474', '15.4', '19.6', '60.9', '1.9'] },
  { y: 2773, size: '並盛', values: ['633', '19.6', '23.6', '88.2', '2.5'] },
  { y: 2747, size: '特盛', values: ['1,006', '33.5', '44.2', '122.3', '4.0'] },
  { y: 2720, values: ['20', '1.3', '0.6', '2.5', '1.3'] },
];

describe('parseNutritionPage', () => {
  it('結合セルのメニュー名を行に割り当て、備考を除いて数値を読み取る', () => {
    expect(
      parseNutritionPage(
        page(gyudonRows, [
          // 備考（※…と字下げされた続き）も含めた全体が、3 行の中心に書かれている
          { str: '牛丼', x: 193, y: 2812 },
          { str: '※牛丼のアレルゲン「小麦」は醤油由来に', x: 193, y: 2770 },
          { str: 'なります。', x: 204, y: 2735 },
          { str: 'みそ汁', x: 193, y: 2720 },
          // カテゴリーの縦書きの 1 文字と、数値の右のアレルギー物質欄は読み飛ばす
          { str: '丼', x: 157, y: 2760 },
          { str: '○', x: 1093, y: 2773 },
        ]),
      ),
    ).toEqual([
      {
        name: '牛丼',
        size: '小盛',
        calories: 474,
        protein: 15.4,
        fat: 19.6,
        carbs: 60.9,
      },
      {
        name: '牛丼',
        size: '並盛',
        calories: 633,
        protein: 19.6,
        fat: 23.6,
        carbs: 88.2,
      },
      {
        name: '牛丼',
        size: '特盛',
        calories: 1006,
        protein: 33.5,
        fat: 44.2,
        carbs: 122.3,
      },
      {
        name: 'みそ汁',
        calories: 20,
        protein: 1.3,
        fat: 0.6,
        carbs: 2.5,
      },
    ]);
  });

  it('次の行に続く（…）の商品名はつなげ、同じ行で分かれた商品名も半角にしてつなげる', () => {
    const rows = parseNutritionPage(
      page(
        [
          {
            y: 2802,
            size: '並盛',
            values: ['752', '28.5', '26.8', '98.6', '3.1'],
          },
          {
            y: 2779,
            size: '大盛',
            values: ['960', '35.9', '33.0', '129.5', '3.3'],
          },
          { y: 2752, values: ['110', '2.0', '8.5', '7.0', '0.3'] },
        ],
        [
          { str: '大判豚肩ロース焼き丼', x: 193, y: 2802 },
          { str: '（旨ダレ生姜）', x: 193, y: 2779 },
          { str: 'テイクアウト用', x: 193, y: 2752 },
          { str: '七味', x: 325, y: 2752 },
        ],
      ),
    );
    expect(rows.map((row) => row.name)).toEqual([
      '大判豚肩ロース焼き丼(旨ダレ生姜)',
      '大判豚肩ロース焼き丼(旨ダレ生姜)',
      'テイクアウト用 七味',
    ]);
  });

  it('行に合わないサイズ欄の文字は読み飛ばす', () => {
    const rows = parseNutritionPage(
      page(gyudonRows.slice(0, 1), [
        { str: '牛丼', x: 193, y: 2800 },
        { str: '含まず', x: 529, y: 2500 },
      ]),
    );
    expect(rows).toHaveLength(1);
  });

  it('日本語の表でないページ（表紙・外国語の表）は空にする', () => {
    expect(
      parseNutritionPage([{ str: 'メニュー別・栄養成分', x: 260, y: 1772 }]),
    ).toEqual([]);
    expect(
      parseNutritionPage(
        page(gyudonRows, [{ str: 'Beef Bowl', x: 193, y: 2760 }]).filter(
          (item) => item.str !== 'メニュー',
        ),
      ),
    ).toEqual([]);
  });

  it('数値が欠けた行があれば例外にする', () => {
    const rows = [
      { y: 2800, size: '並盛', values: ['633', '19.6', '23.6', '88.2'] },
    ];
    expect(() =>
      parseNutritionPage(page(rows, [{ str: '牛丼', x: 193, y: 2800 }])),
    ).toThrow('栄養成分の行が読み取れません');
  });

  it('数値でない文字があれば例外にする', () => {
    const rows = [
      { y: 2800, size: '並盛', values: ['633', '19.6', '-', '88.2', '2.5'] },
    ];
    expect(() =>
      parseNutritionPage(page(rows, [{ str: '牛丼', x: 193, y: 2800 }])),
    ).toThrow('栄養成分の数値が読み取れません: -');
  });

  it('メニュー名の割り当たらない行があれば例外にする', () => {
    expect(() =>
      parseNutritionPage(page(gyudonRows, [{ str: '牛丼', x: 193, y: 2773 }])),
    ).toThrow('メニューの無い行があります');
  });
});

describe('parseMenuListPage', () => {
  it('商品ページの URL を重複なく返し、おすすめのリンクは含めない', () => {
    expect(
      parseMenuListPage(`
        <div class="menu__unit">
          <a href="https://www.yoshinoya.com/lp/tsukimi_202608/">月見</a>
        </div>
        <div class="menu__unit">
          <a href="https://www.yoshinoya.com/menu/gyudon/gyu-don/">牛丼</a>
        </div>
        <div class="menu__unit">
          <a href="https://www.yoshinoya.com/menu/gyudon/gyu-don/">牛丼</a>
        </div>
        <div class="menu__unit">
          <a href="https://www.yoshinoya.com/menu/sidemenu/egg/">玉子</a>
        </div>`),
    ).toEqual([
      'https://www.yoshinoya.com/menu/gyudon/gyu-don/',
      'https://www.yoshinoya.com/menu/sidemenu/egg/',
    ]);
  });
});

describe('parseMenuPage', () => {
  const price = (taxIn: string, label?: string) => `
    <li><div class="menu__price__wrapper">
      ${label === undefined ? '' : `<div class="menu__label">${label}</div>`}
      <div class="menu__price">
        <span class="menu__price__taxout">100</span>円
        <div class="menu__price__cap">(税込<span class="menu__price__taxin">${taxIn}</span>円)</div>
      </div>
    </div></li>`;
  const eatIn = (list: string) =>
    `<div class="tab__contents__unit tab__contents__eatin displayed"><ul>${list}</ul></div>`;
  const takeout = (list: string) =>
    `<div class="tab__contents__unit tab__contents__takeout"><ul>${list}</ul></div>`;

  it('商品名と、店内価格のサイズごとの税込価格を読み取る（テイクアウト価格は読まない）', () => {
    expect(
      parseMenuPage(`
        <h1>牛丼</h1>
        ${eatIn(price('465', '小盛') + price('1,059', '超特盛'))}
        ${takeout(price('456', '小盛') + price('1,039', '超特盛'))}`),
    ).toEqual({
      name: '牛丼',
      prices: [
        { size: '小盛', price: 465 },
        { size: '超特盛', price: 1059 },
      ],
    });
  });

  it('サイズの無い商品はサイズが空文字', () => {
    expect(
      parseMenuPage(
        `<h1>玉子</h1>${eatIn(price('118'))}${takeout(price('116'))}`,
      ),
    ).toEqual({ name: '玉子', prices: [{ size: '', price: 118 }] });
  });

  it('店内価格の無い持ち帰り専用の商品は価格が空', () => {
    expect(parseMenuPage(`<h1>牛焼肉皿</h1>${takeout(price('622'))}`)).toEqual({
      name: '牛焼肉皿',
      prices: [],
    });
  });

  it('店内価格の欄があるのに価格が読めなければ例外にする', () => {
    expect(() => parseMenuPage(`<h1>牛丼</h1>${eatIn('')}`)).toThrow(
      '店内価格が読み取れません',
    );
  });

  it('価格表が無ければ例外にする', () => {
    expect(() => parseMenuPage('<h1>牛丼</h1>')).toThrow(
      '価格表が読み取れません',
    );
  });

  it('商品名が無ければ例外にする', () => {
    expect(() => parseMenuPage(eatIn(price('465')))).toThrow(
      '商品名が読み取れません',
    );
  });
});
