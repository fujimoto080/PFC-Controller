import { parseProductPage, parseSeriesList } from '@/lib/catalog/itoham';

/** 商品詳細ページの名前と栄養成分の部分。tables は（単位, 見出し→値）の組。 */
function page(
  name: string,
  tables: readonly (readonly [string, Record<string, string>])[],
) {
  const nutrition = tables
    .map(([unit, cells]) => {
      const heads = Object.keys(cells)
        .map((label) => `<th>${label}</th>`)
        .join('');
      const values = Object.values(cells)
        .map((value) => `<td>${value}</td>`)
        .join('');
      return `<div class="nutritionfacts_desc">${unit}</div><table><tr>${heads}</tr><tr>${values}</tr></table>`;
    })
    .join('');
  const block =
    tables.length === 0
      ? ''
      : `<div class="productNutritionfacts"><h3>栄養成分</h3><div>${nutrition}</div></div>`;
  return `<div class="dbName"><h3>商品名</h3><div>${name}</div></div>${block}`;
}

const saladChicken = {
  熱量: '103kcal',
  たんぱく質: '20.9g',
  脂質: '1.8g',
  炭水化物: '1.4g',
  糖質: '0g',
};

describe('parseSeriesList', () => {
  it('商品番号を重複なく読み取る', () => {
    const html = `
<li><div class="dbPhoto"><a href="/product/product/detail.html?pdid=480" target="_blank"><img src="a.jpg" /></a></div>
<p class="linkBtn"><a href="/product/product/detail.html?pdid=480">商品詳細情報</a></p></li>
<li><div class="dbPhoto"><a href="/product/product/detail.html?pdid=1377" target="_blank"><img src="b.jpg" /></a></div></li>`;
    expect(parseSeriesList(html)).toEqual(['480', '1377']);
  });

  it('商品が 1 件も読めなければ例外にする', () => {
    expect(() => parseSeriesList('<html></html>')).toThrow(
      '商品の一覧が読み取れません',
    );
  });
});

describe('parseProductPage', () => {
  it('1 パックあたりの名前と栄養成分を読み取る', () => {
    expect(
      parseProductPage(
        page('じぶんプラス　糖質０サラダチキン（プレーン）', [
          ['（1パック（110g）当たり）', saladChicken],
        ]),
      ),
    ).toEqual({
      name: 'じぶんプラス 糖質0サラダチキン(プレーン)',
      calories: 103,
      protein: 20.9,
      fat: 1.8,
      carbs: 1.4,
    });
  });

  it('名前の札（Renewal）と文字参照を除く', () => {
    const html = page('ラピッツァ　ベーコン&amp;ジェノベーゼ', [
      ['（ピザ1枚当たり（推定値））', saladChicken],
    ]).replace('ジェノベーゼ', 'ジェノベーゼ<span>Renewal</span>');
    expect(parseProductPage(html)?.name).toBe(
      'ラピッツァ ベーコン&ジェノベーゼ',
    );
  });

  it('栄養成分が複数載っていれば先頭の表を使う', () => {
    const second = { ...saladChicken, 熱量: '514kcal' };
    expect(
      parseProductPage(
        page('ラ・ピッツァ　マルゲリータ', [
          [
            '（ピザ1枚＋添付ソース合計（推定値））',
            {
              ...saladChicken,
              熱量: '544kcal',
            },
          ],
          ['（ピザ1枚当たり（推定値））', second],
        ]),
      )?.calories,
    ).toBe(544);
  });

  it('値に単位が付いていなくても読み取る', () => {
    expect(
      parseProductPage(
        page('ピザ', [
          [
            '（ピザ1枚当たり（推定値））',
            { 熱量: '335', たんぱく質: '10.9', 脂質: '2.7', 炭水化物: '66.7' },
          ],
        ]),
      ),
    ).toMatchObject({ calories: 335, carbs: 66.7 });
  });

  it('栄養成分が載っていない商品は undefined', () => {
    expect(parseProductPage(page('商品', []))).toBeUndefined();
  });

  it('1 本あたりなど 1 食分でない単位は undefined', () => {
    expect(
      parseProductPage(page('スティック', [['（1本当たり）', saladChicken]])),
    ).toBeUndefined();
  });

  it('値が範囲で 1 食分が決まらない商品は undefined', () => {
    expect(
      parseProductPage(
        page('スモーク', [
          ['（1パック（110g）当たり）', { ...saladChicken, 脂質: '0.7~3.1g' }],
        ]),
      ),
    ).toBeUndefined();
  });

  it('ピザ生地だけの商品は undefined', () => {
    expect(
      parseProductPage(
        page('ラ・ピッツァ　熟成生地のピザクラスト', [
          ['（ピザ1枚当たり（推定値））', saladChicken],
        ]),
      ),
    ).toBeUndefined();
  });

  it('栄養成分の項目が欠けていれば例外にする', () => {
    const { 脂質: _fat, ...rest } = saladChicken;
    expect(() =>
      parseProductPage(page('商品', [['（1パック当たり）', rest]])),
    ).toThrow('脂質が読み取れません');
  });

  it('値の形が違えば例外にする', () => {
    expect(() =>
      parseProductPage(
        page('商品', [
          ['（1パック当たり）', { ...saladChicken, 熱量: '約百' }],
        ]),
      ),
    ).toThrow('熱量が読み取れません');
  });

  it('商品名が読めなければ例外にする', () => {
    expect(() => parseProductPage('<html></html>')).toThrow(
      '商品名が読み取れません',
    );
  });
});
