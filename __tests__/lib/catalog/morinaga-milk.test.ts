import {
  MORINAGA_MILK_CATEGORIES,
  parseProductLinks,
  parseProductPage,
} from '@/lib/catalog/morinaga-milk';

const URL =
  'https://www.morinagamilk.co.jp/products/yoghurt/partheno/1015.html';

/** 栄養成分が表（項目名と値の組）の商品ページの一部。 */
function tablePage({
  name = 'ギリシャヨーグルト パルテノ プレーン砂糖不使用',
  amount = '100g ',
  basis = '（1個(100g)当たり）',
}: { name?: string; amount?: string; basis?: string } = {}) {
  return `<h1>${name}</h1>
<dl><dt>内容量</dt><dd>${amount}</dd></dl>
<div class="ingredients"><header><h2>栄養成分
<small>${basis}</small></h2></header>
<div class="spec-table">
<dl class="trio-duo"><dt>エネルギー</dt><dd>99kcal</dd></dl>
<dl class="trio-duo"><dt>たんぱく質</dt><dd>10.2g</dd></dl>
<dl class="trio-duo"><dt>脂質</dt><dd>4.3g</dd></dl>
<dl class="trio-duo"><dt>炭水化物</dt><dd>4.9g</dd></dl>
<dl class="trio-duo"><dt>食塩相当量</dt><dd>0.09g</dd></dl>
</div></div></section>`;
}

/** 栄養成分が 1 行の文の商品ページの一部。 */
const sentencePage = (
  nutrition: string,
) => `<h1>ｉｎＰＲＯＴＥＩＮ 甘くないカフェオレ</h1>
<dl><dt>内容量</dt><dd>330ml</dd></dl>
<div class="ingredients"><header><h2>栄養成分
<small>（１本330ml当たり）</small></h2></header>
<p class="seibun">
${nutrition}<br />
ビタミンB2：0.7mg
</p></div></section>`;

describe('MORINAGA_MILK_CATEGORIES', () => {
  it('ヨーグルトもプロテイン飲料も副菜', () => {
    expect(
      MORINAGA_MILK_CATEGORIES.map(({ slug, role }) => [slug, role]),
    ).toEqual([
      ['yoghurt', 'side'],
      ['drink', 'side'],
    ]);
  });
});

describe('parseProductLinks', () => {
  it('カテゴリの商品ページを重複なく読み取る', () => {
    const html = `<a href="/products/yoghurt/partheno/1015.html">a</a>
<a href="/products/yoghurt/partheno/1015.html">a</a>
<a href="/products/yoghurt/bifidus/88.html">b</a>
<a href="/products/drink/inprotein/9857.html">c</a>`;
    expect(parseProductLinks(html, 'yoghurt')).toEqual([
      'https://www.morinagamilk.co.jp/products/yoghurt/partheno/1015.html',
      'https://www.morinagamilk.co.jp/products/yoghurt/bifidus/88.html',
    ]);
  });

  it('商品ページが 1 件も無ければ例外にする', () => {
    expect(() => parseProductLinks('<html></html>', 'yoghurt')).toThrow(
      'yoghurt の商品ページが読み取れません',
    );
  });
});

describe('parseProductPage', () => {
  it('表の栄養成分と商品名・商品番号・商品ページの URL を読み取る（価格は無し）', () => {
    expect(parseProductPage(tablePage(), 'yoghurt', URL)).toEqual([
      {
        id: '1015',
        name: 'ギリシャヨーグルト パルテノ プレーン砂糖不使用',
        category: 'yoghurt',
        url: URL,
        calories: 99,
        protein: 10.2,
        fat: 4.3,
        carbs: 4.9,
      },
    ]);
  });

  it('1 行の文の栄養成分も読み、全角の商品名を揃える', () => {
    const [item] = parseProductPage(
      sentencePage(
        'エネルギー:137kcal、たんぱく質:20.2g、脂質:0g、炭水化物:14.0g、食塩相当量:0.32g',
      ),
      'drink',
      'https://www.morinagamilk.co.jp/products/drink/inprotein/9857.html',
    );
    expect(item).toMatchObject({
      id: '9857',
      name: 'inPROTEIN 甘くないカフェオレ',
      calories: 137,
      protein: 20.2,
      fat: 0,
      carbs: 14,
    });
  });

  it('項目名が重なって載っている栄養成分も読む', () => {
    const [item] = parseProductPage(
      sentencePage(
        'エネルギー:エネルギー:114kcal、たんぱく質:10.0g、脂質:4.2g、炭水化物:9.1g',
      ),
      'drink',
      URL,
    );
    expect(item).toMatchObject({ calories: 114, protein: 10 });
  });

  it('本体と添付品を合わせた量が内容量になる商品は読む', () => {
    expect(
      parseProductPage(
        tablePage({ amount: '88g', basis: '（本体80g＋添付品8g当たり ）' }),
        'yoghurt',
        URL,
      ),
    ).toHaveLength(1);
  });

  it('複数個入り・内容量全体の栄養成分でない商品は除く', () => {
    expect(
      parseProductPage(tablePage({ amount: '75g×4' }), 'yoghurt', URL),
    ).toEqual([]);
    expect(
      parseProductPage(
        tablePage({ amount: '280g', basis: '（100g当たり）' }),
        'yoghurt',
        URL,
      ),
    ).toEqual([]);
  });

  it('栄養成分の無い商品は除く', () => {
    const html = `<h1>森永サプリ</h1>
<dl><dt>内容量</dt><dd>100g</dd></dl>
<div class="ingredients"><header><h2>栄養成分<small>（1個(100g)当たり）</small></h2></header></div></section>`;
    expect(parseProductPage(html, 'yoghurt', URL)).toEqual([]);
  });

  it('ドリンクはプロテイン飲料以外を除く', () => {
    const page = tablePage({ name: 'リプトン レモンティー 200ml' });
    expect(parseProductPage(page, 'drink', URL)).toEqual([]);
    expect(parseProductPage(page, 'yoghurt', URL)).toHaveLength(1);
  });

  it('栄養成分が載っているのに読めなければ例外にする', () => {
    expect(() =>
      parseProductPage(sentencePage('エネルギー:137kcal'), 'drink', URL),
    ).toThrow('たんぱく質');
  });

  it('内容量が無ければ例外にする', () => {
    expect(() =>
      parseProductPage('<h1>森永</h1><p>ページの形が違う</p>', 'yoghurt', URL),
    ).toThrow('内容量');
  });
});
