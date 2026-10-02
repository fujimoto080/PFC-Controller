import { parseProductIds, parseProductPage } from '@/lib/catalog/primaham';

/** 商品ページ。栄養成分の見出しと表を差し替える。 */
function productPage(
  heading: string,
  cells = {
    エネルギー: '101kcal',
    たんぱく質: '21.3g',
    脂質: '1.6g',
    炭水化物: '0.5g',
  },
) {
  const ths = Object.keys(cells)
    .map((label) => `<th>${label}</th>`)
    .join('');
  const tds = Object.values(cells)
    .map((value) => `<td>${value}</td>`)
    .join('');
  return `
<h2 class="ttl-cmn-02 ttl-ham">
  <div class="txt-title">糖質ゼロ　九州産鶏肉使用<br />サラダチキン&reg;　スモーク</div>
</h2>
<h3 class="ttl-cmn-03">${heading}</h3>
<table class="table-nutritional only-pc"><thead><tr>${ths}</tr></thead><tbody><tr>${tds}</tr></tbody></table>`;
}

describe('parseProductIds', () => {
  it('商品リストの中の商品番号を重複なく読み取る', () => {
    const html = `
<a href="https://www.primaham.co.jp/products/detail/9999.html">ヘッダー</a>
<ul class="list-brand-products">
  <li><a href="https://www.primaham.co.jp/products/detail/0033.html">A</a></li>
  <li><a href="https://www.primaham.co.jp/products/detail/0034.html">B</a></li>
  <li><a href="https://www.primaham.co.jp/products/detail/0033.html">A</a></li>
</ul>`;
    expect(parseProductIds(html)).toEqual(['0033', '0034']);
  });

  it('商品が読めなければ例外にする', () => {
    expect(() => parseProductIds('<html></html>')).toThrow(
      '商品の一覧が読み取れません',
    );
    expect(() =>
      parseProductIds('<ul class="list-brand-products"></ul>'),
    ).toThrow('商品の一覧が読み取れません');
  });
});

describe('parseProductPage', () => {
  it('1 袋あたりの商品名と栄養成分を読み取る', () => {
    expect(
      parseProductPage(productPage('栄養成分表示 （1袋100g当たり）')),
    ).toEqual({
      name: '糖質ゼロ 九州産鶏肉使用 サラダチキン® スモーク',
      calories: 101,
      protein: 21.3,
      fat: 1.6,
      carbs: 0.5,
    });
  });

  it('全角の「ｇ」や「あたり」の見出しも 1 パック・1 本あたりとして読む', () => {
    expect(
      parseProductPage(productPage('栄養成分表示 （1パック50ｇ当たり）')),
    ).toBeDefined();
    expect(
      parseProductPage(productPage('栄養成分表示 （1本67gあたり）')),
    ).toBeDefined();
  });

  it('100g 当たりなど販売単位あたりでない商品は除く', () => {
    expect(
      parseProductPage(productPage('栄養成分表示 （100g当たり）')),
    ).toBeUndefined();
    expect(
      parseProductPage(productPage('栄養成分表示 （34g当たり）')),
    ).toBeUndefined();
  });

  it('栄養成分が載っていない商品は除く', () => {
    expect(parseProductPage('<h2 class="ttl-cmn-02">x</h2>')).toBeUndefined();
  });

  it('販売単位あたりなのに表が読めなければ例外にする', () => {
    expect(() =>
      parseProductPage(
        productPage('栄養成分表示 （1袋100g当たり）', {
          エネルギー: '101kcal',
          たんぱく質: '-',
          脂質: '1.6g',
          炭水化物: '0.5g',
        }),
      ),
    ).toThrow('栄養成分のたんぱく質が読み取れません');
    expect(() =>
      parseProductPage(
        '<h3 class="ttl-cmn-03">栄養成分表示 （1袋100g当たり）</h3>',
      ),
    ).toThrow('栄養成分の表が読み取れません');
  });
});
