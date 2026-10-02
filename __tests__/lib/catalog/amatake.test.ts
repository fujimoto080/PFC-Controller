import {
  AMATAKE_CATEGORIES,
  parseCategoryPage,
  parseProductPage,
} from '@/lib/catalog/amatake';

/** 商品ページ。商品スペックと JSON-LD の必要な部分だけ。 */
function page({
  name = '赤鶏むね一枚肉サラダチキン プレーン',
  price = '311',
  specs = `
      <dt>栄養成分</dt>
      <dd>［1パック(81g)当たり（分析値）］ エネルギー：92kcal たんぱく質：20.3g 脂質：1.1g 炭水化物：0.4g（糖質：0.2g 食物繊維：0.2g） 食塩相当量：0.6g</dd>
      <dt>内容量</dt>
      <dd>81g</dd>`,
}: { name?: string; price?: string; specs?: string } = {}) {
  return `<dl>${specs}</dl>
<script type="application/ld+json">
  {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": "${name}",
    "offers": {
      "@type": "Offer",
      "price": "${price}",
      "priceCurrency": "JPY"
    }
  }
</script>`;
}

describe('AMATAKE_CATEGORIES', () => {
  it('すべて副菜', () => {
    expect(AMATAKE_CATEGORIES.map(({ slug, role }) => [slug, role])).toEqual([
      ['salad_chicken', 'side'],
      ['protein_deli', 'side'],
      ['soup', 'side'],
      ['duck', 'side'],
    ]);
  });
});

describe('parseCategoryPage', () => {
  it('商品ページへのリンクから商品番号を重複なく読み取る', () => {
    const html = `
      <a href="https://ec.amatake.co.jp/shop/products/387861">banner</a>
      <a href="/shop/products/306795">a</a>
      <a href="/shop/products/306795">a</a>
      <a href="/shop/products/recommend14">set</a>
      <a href="/shop/product_categories/soup">category</a>`;
    expect(parseCategoryPage(html)).toEqual([
      '387861',
      '306795',
      'recommend14',
    ]);
  });

  it('商品が 1 つも無ければ例外', () => {
    expect(() => parseCategoryPage('<html></html>')).toThrow(
      '商品の一覧が読み取れません',
    );
  });
});

describe('parseProductPage', () => {
  it('商品名・税込価格・1 パック分の栄養成分を読み取る', () => {
    expect(parseProductPage(page())).toEqual({
      name: '赤鶏むね一枚肉サラダチキン プレーン',
      price: 311,
      calories: 92,
      protein: 20.3,
      fat: 1.1,
      carbs: 0.4,
    });
  });

  it('商品名の先頭の販売形態の注記を除き、「1P100g当たり」の表記も読む', () => {
    expect(
      parseProductPage(
        page({
          name: '＼公式ショップ限定商品／ サラダチキンランチ ツナマヨ',
          price: '375',
          specs: `
      <dt>栄養成分</dt>
      <dd>[1P100g当たり] エネルギー：136kcal たんぱく質：23.0g 脂質：4.9g 炭水化物：0.0g 食塩相当量：1.6g</dd>
      <dt>内容量</dt>
      <dd>100g</dd>`,
        }),
      ),
    ).toEqual({
      name: 'サラダチキンランチ ツナマヨ',
      price: 375,
      calories: 136,
      protein: 23,
      fat: 4.9,
      carbs: 0,
    });
  });

  it('栄養成分の無い商品（生肉・セット商品）は除く', () => {
    expect(
      parseProductPage(
        page({
          specs: `
      <dt>内容量</dt>
      <dd>2枚入り(400g)</dd>`,
        }),
      ),
    ).toBeUndefined();
  });

  it('内容量と違う量あたり（100g あたりなど）の栄養成分は除く', () => {
    expect(
      parseProductPage(
        page({
          specs: `
      <dt>栄養成分</dt>
      <dd>［100ｇ当たり］ エネルギー：177kcal たんぱく質：14.3g 脂質：12.0g 炭水化物：2.9g 食塩相当量：1.1g</dd>
      <dt>内容量</dt>
      <dd>90g ※付け合わせの野菜等は入っておりません。</dd>`,
        }),
      ),
    ).toBeUndefined();
  });

  it('複数パックのセットは除き、1 パックの表記は読む', () => {
    const specs = (amount: string) => `
      <dt>栄養成分</dt>
      <dd>［260g当たり］ エネルギー：16kcal たんぱく質：4.2g 脂質：0.0g 炭水化物：0.0g 食塩相当量：0.2g</dd>
      <dt>内容量</dt>
      <dd>${amount}</dd>`;
    expect(
      parseProductPage(page({ specs: specs('260ｇ×10パック') })),
    ).toBeUndefined();
    expect(parseProductPage(page({ specs: specs('260g × 1パック') }))).toEqual(
      expect.objectContaining({ calories: 16, protein: 4.2 }),
    );
  });

  it('栄養成分が載っているのにエネルギーが読めなければ例外', () => {
    expect(() =>
      parseProductPage(
        page({
          specs: `
      <dt>栄養成分</dt>
      <dd>［1パック(81g)当たり］ たんぱく質：20.3g 脂質：1.1g 炭水化物：0.4g</dd>
      <dt>内容量</dt>
      <dd>81g</dd>`,
        }),
      ),
    ).toThrow('エネルギーが読み取れません');
  });

  it('価格が読めなければ例外', () => {
    expect(() =>
      parseProductPage(page().replace(/"price": "311",/, '')),
    ).toThrow('の価格が読み取れません');
  });
});
