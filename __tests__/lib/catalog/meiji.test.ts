import {
  MEIJI_CATEGORIES,
  parseProductList,
  parseProductPage,
} from '@/lib/catalog/meiji';

/** 商品ページ。heading は栄養成分表示の見出し、rows は栄養成分表の行。 */
function page(
  heading: string | undefined,
  rows: Record<string, string> = {
    エネルギー: '96kcal',
    たんぱく質: '15.0g',
    脂質: '0g',
    炭水化物: '10.0g',
    食塩相当量: '0.22g',
  },
) {
  const trs = Object.entries(rows)
    .map(([th, td]) => `<tr><th scope="row">${th}</th><td>${td}</td></tr>`)
    .join('');
  const nutrition =
    heading === undefined
      ? ''
      : `<h2 class="m-heading2">栄養成分表示 ${heading}</h2>
<div class="l-table"><table class="m-table"><tbody>${trs}</tbody></table></div>`;
  return `<h1 class="m-heading1 _sm"><span class="m-heading-sup">ザバス MILK PROTEIN</span>（ザバス）MILK PROTEIN 脂肪0 ヨーグルト風味 430ml</h1>
<h2 class="m-heading2">商品概要</h2>
<div class="l-table"><table class="m-table"><tbody><tr><th>内容量</th><td>430ml</td></tr></tbody></table></div>
${nutrition}`;
}

describe('MEIJI_CATEGORIES', () => {
  it('どのカテゴリも副菜', () => {
    expect(MEIJI_CATEGORIES.map(({ slug, role }) => [slug, role])).toEqual([
      ['savas', 'side'],
      ['protein-bar', 'side'],
      ['protein-powder', 'side'],
      ['yogurt', 'side'],
    ]);
  });
});

describe('parseProductList', () => {
  const list = `
<h2 id="category01" class="m-heading2"><div class="m-heading-btn-img">ザバス MILK PROTEIN</div></h2>
<ul><li><a href="/products/sports/4902705001879.html" class="l-card"><p>A</p></a></li>
<li><a href="/products/sports/4902705132306.html" class="l-card" data-new><p>B</p></a></li></ul>
<h2 id="category02" class="m-heading2"><div class="m-heading-btn-img">ザバス（グッズ）</div></h2>
<ul><li><a href="/products/sports/48009.html" class="l-card"><p>シェイカー</p></a></li></ul>
<h2 id="category03" class="m-heading2"><div class="m-heading-btn-img">ザバス プロテインバー</div></h2>
<ul><li><a href="/products/sports/4902777313801.html" class="l-card"><p>C</p></a></li>
<li><a href="/products/sports/4902705001879.html" class="l-card"><p>A</p></a></li></ul>`;

  it('小見出しごとの商品ページを読み取り、除く小見出しの商品と重複は入れない', () => {
    expect(parseProductList(list, ['ザバス(グッズ)'])).toEqual([
      {
        id: '4902705001879',
        path: '/products/sports/4902705001879.html',
        section: 'ザバス MILK PROTEIN',
      },
      {
        id: '4902705132306',
        path: '/products/sports/4902705132306.html',
        section: 'ザバス MILK PROTEIN',
      },
      {
        id: '4902777313801',
        path: '/products/sports/4902777313801.html',
        section: 'ザバス プロテインバー',
      },
    ]);
  });

  it('商品が 1 件も読めなければ例外にする', () => {
    expect(() => parseProductList('<html></html>', [])).toThrow(
      '商品の一覧が読み取れません',
    );
  });
});

describe('parseProductPage', () => {
  it('商品名（ブランド表記を除く）と 1 本あたりの栄養成分を読み取る', () => {
    expect(parseProductPage(page('1本（430ml）あたり'))).toEqual({
      name: '(ザバス)MILK PROTEIN 脂肪0 ヨーグルト風味 430ml',
      portion: false,
      calories: 96,
      protein: 15,
      fat: 0,
      carbs: 10,
    });
  });

  it('1食分で載っている粉末は名前に 1 回分の量を付ける', () => {
    expect(parseProductPage(page('1食分（28g）あたり'))).toMatchObject({
      name: '(ザバス)MILK PROTEIN 脂肪0 ヨーグルト風味 430ml 1食分(28g)',
      portion: true,
    });
  });

  it('栄養成分が無い商品、100g あたり・2食分の商品は undefined', () => {
    expect(parseProductPage(page(undefined))).toBeUndefined();
    expect(parseProductPage(page('100gあたり'))).toBeUndefined();
    expect(parseProductPage(page('100mlあたり'))).toBeUndefined();
    expect(parseProductPage(page('2食分（28g）あたり'))).toBeUndefined();
  });

  it('たんぱく質が幅で載っている商品は undefined', () => {
    expect(
      parseProductPage(
        page('1本分（300ml）あたり', {
          エネルギー: '118kcal',
          たんぱく質: '15.0～19.0g',
          脂質: '1.0g',
          炭水化物: '11.1g',
        }),
      ),
    ).toBeUndefined();
  });

  it('単位が読めない・栄養成分の行が無い場合は例外にする', () => {
    expect(() => parseProductPage(page('コップ1杯（200ml）あたり'))).toThrow(
      '栄養成分の単位が読み取れません',
    );
    expect(() =>
      parseProductPage(page('1本（430ml）あたり', { エネルギー: '96kcal' })),
    ).toThrow('たんぱく質が読み取れません');
  });
});
