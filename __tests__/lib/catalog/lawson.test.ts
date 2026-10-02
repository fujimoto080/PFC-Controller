import {
  isSoldInKanto,
  parseItemPage,
  parseListPage,
} from '@/lib/catalog/lawson';

/** 公式サイトの商品ページから必要な部分だけを抜き出した HTML。 */
function itemPage({
  price = '<dd><span>1,149</span><span>円(税込)</span></dd>',
  nutrition,
}: {
  price?: string;
  nutrition?: { basis: string; values: Record<string, string> };
}) {
  const rows = Object.entries(nutrition?.values ?? {})
    .map(
      ([label, value]) =>
        `<li><dl>\n<dt>${label}</dt>\n<dd>${value}</dd>\n</dl></li>`,
    )
    .join('\n');
  return `
    <div class="rightBlock">
      <h2 class="ttl">塩昆布と沢庵おにぎり(国産もち麦入り)</h2>
      <dl class="price"><dt>ローソン標準価格</dt>${price}</dl>
      ${
        nutrition === undefined
          ? ''
          : `<div class="nutritionFacts_table">
              <h3>栄養成分<span>${nutrition.basis}</span></h3>
              <ul class="tbody">${rows}</ul>
            </div>`
      }
    </div>`;
}

const VALUES = {
  熱量: '162kcal',
  たんぱく質: '3.9g',
  脂質: '1.3g',
  炭水化物: '34.8g',
  食塩相当量: '1.16g',
};

describe('parseItemPage', () => {
  it('商品名・税込価格・栄養成分を読み取る', () => {
    expect(
      parseItemPage(
        itemPage({ nutrition: { basis: '【1包装当たり】', values: VALUES } }),
      ),
    ).toEqual({
      name: '塩昆布と沢庵おにぎり(国産もち麦入り)',
      price: 1149,
      calories: 162,
      protein: 3.9,
      fat: 1.3,
      carbs: 34.8,
    });
  });

  it('幅のある表記は真ん中の値にする', () => {
    expect(
      parseItemPage(
        itemPage({
          nutrition: {
            basis: '【1袋(65g)当たり】',
            values: { ...VALUES, 脂質: '3.6〜5.7g', 炭水化物: '1.3〜4.1g' },
          },
        }),
      ),
    ).toMatchObject({ fat: 4.7, carbs: 2.7 });
  });

  it('栄養成分を載せていない商品は undefined', () => {
    expect(parseItemPage(itemPage({}))).toBeUndefined();
  });

  it('栄養成分が重さ当たりの商品は undefined', () => {
    for (const basis of ['【100g当たり】', '【たまご100g当たり】']) {
      expect(
        parseItemPage(itemPage({ nutrition: { basis, values: VALUES } })),
      ).toBeUndefined();
    }
  });

  it('デリバリー専用の商品は undefined', () => {
    expect(
      parseItemPage(
        itemPage({
          price: '<dd>デリバリー価格<span>680</span><span>円(税込)</span></dd>',
          nutrition: { basis: '【10粒当たり】', values: VALUES },
        }),
      ),
    ).toBeUndefined();
  });

  it('栄養成分の表記が想定と違えば例外にする', () => {
    expect(() =>
      parseItemPage(
        itemPage({
          nutrition: {
            basis: '【1包装当たり】',
            values: { ...VALUES, 炭水化物: '-' },
          },
        }),
      ),
    ).toThrow('栄養成分の炭水化物が読み取れません');
  });
});

describe('parseListPage', () => {
  it('関東で買える商品の商品番号と、取り扱い地域の注記だけを返す', () => {
    const html = `
      <li>
        <p class="img"><a href="/recommend/original/detail/1532622_1996.html"><img src="a.jpg"></a></p>
        <p class="ttl">プレミアムおにぎり　黒毛和牛カルビ焼肉</p>
        <p>1包装当たり253kcal</p>
        <p class="price"><span>322</span><span>円(税込)</span></p>
      </li>
      <li>
        <p class="img"><a href="/recommend/original/detail/1532621_1996.html"><img src="b.jpg"></a></p>
        <p class="ttl">プレミアムおにぎり　紀州南高梅</p>
        <p class="price"><span>225</span><span>円(税込)</span></p>
        <div class="smalltxt" style="padding-top:5px;"><ul><li>※沖縄地域のローソンではお取り扱いしておりません。</li><li>※熱量表示は関東地域のものを掲載しております。</li><li>※一部地域で販売終了となっております。</li></ul></div>
      </li>
      <li>
        <p class="img"><a href="/recommend/original/detail/1527632_1996.html"><img src="c.jpg"></a></p>
        <p class="ttl">プレミアムおにぎり　いくら醤油漬</p>
        <p class="price"><span>322</span><span>円(税込)</span></p>
        <div class="smalltxt" style="padding-top:5px;"><ul><li>※熱量表示は関東地域のものを掲載しております。</li></ul></div>
      </li>
      <li>
        <p class="img"><a href="/recommend/original/detail/1529966_1996.html"><img src="d.jpg"></a></p>
        <p class="ttl">北海道産じゃがいもの牛肉じゃが</p>
        <p class="price"><span>343</span><span>円(税込)</span></p>
        <div class="smalltxt" style="padding-top:5px;"><ul><li>※近畿・中四国・九州地域のローソンのみのお取り扱いとなります。</li></ul></div>
      </li>`;
    expect(parseListPage(html)).toEqual([
      { id: '1532622_1996', area: undefined },
      {
        id: '1532621_1996',
        area: '沖縄地域のローソンではお取り扱いしておりません。 一部地域で販売終了となっております。',
      },
      { id: '1527632_1996', area: undefined },
    ]);
  });
});

describe('isSoldInKanto', () => {
  it.each([
    '北海道・東北・関東地域のローソンのみのお取り扱いとなります。',
    '関東(一部)・中部地域のローソンのみのお取り扱いとなります。',
    '東北(青森除く)・関東(新潟除く)・近畿・中四国地域のローソンのみのお取り扱いとなります。',
    '東京・神奈川・埼玉(一部)・千葉・茨城・栃木・群馬地域のローソンのみのお取り扱いとなります。',
    '沖縄地域のローソン、ナチュラルローソンではお取り扱いしておりません。',
    '関東(一部)・中四国(一部)地域のローソンではお取り扱いしておりません。',
    'ナチュラルローソンではお取り扱いしておりません。',
    '一部地域で販売終了となっております。',
    '熱量表示は関東地域のものを掲載しております。',
  ])('関東で買える: %s', (note) => {
    expect(isSoldInKanto(note)).toBe(true);
  });

  it.each([
    '沖縄地域のローソンのみのお取り扱いとなります。',
    '中部・近畿・中四国・九州・沖縄地域のローソン、ナチュラルローソンのみのお取り扱いとなります。',
    '関東・沖縄地域のローソン、ナチュラルローソンではお取り扱いしておりません。',
  ])('関東で買えない: %s', (note) => {
    expect(isSoldInKanto(note)).toBe(false);
  });

  it('どちらの型にも当てはまらない地域の注記は例外にする', () => {
    expect(() =>
      isSoldInKanto('関東地域の一部店舗のみでの販売となります。'),
    ).toThrow('取り扱い地域の注記が読み取れません');
    expect(() =>
      isSoldInKanto(
        '関東地域のローソンストア100ではお取り扱いしておりません。',
      ),
    ).toThrow('取り扱い地域の注記が読み取れません');
  });
});
