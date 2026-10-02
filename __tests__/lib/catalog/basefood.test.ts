import {
  BASEFOOD_CATEGORIES,
  parseProductLinks,
  parseProductPage,
} from '@/lib/catalog/basefood';

/** 商品ページの HTML。RSC ペイロードを self.__next_f.push の文字列として埋め込む。 */
function page({
  note = '※BASE BREAD チョコレート 1袋あたり',
  nutrition = true,
  product = true,
}: { note?: string; nutrition?: boolean; product?: boolean } = {}) {
  const row = (label: string, value: string) =>
    `["$","div",null,{"children":[["$","div",null,{"children":"${label}"}],["$","div",null,{"children":"${value}"}]]}]`;
  const payload = [
    // 栄養成分表示より前の見出し（たんぱく質と食物繊維が並ぶ）に別の値が無いこと
    '["$","div",null,{"children":"たんぱく質"}],["$","div",null,{"children":"食物繊維"}]',
    product
      ? '"product":{"name":"basebread_chocolate","title":"BASE BREAD®","variantTitle":"チョコレート","sku":"102008","price":255,"normalPrice":255,"firstSubscriptionPrice":204,"shopUrl":"https://shop.basefood.co.jp/products/basebread/chocolate","isSpecialLineProduct":false}'
      : '"other":{}',
    `["$","$L3e",null,{"title":"栄養成分表示","children":[${[
      row('熱量', '266kcal'),
      row('たんぱく質', '13.6g'),
      row('脂質', '9.1g'),
      row('炭水化物', '35.4g'),
      row('食塩相当量', '0.3g'),
    ].join(',')}]}]`,
    `["$","p","0",{"children":"${note}"}]`,
  ].join(',');
  return `<html><script>self.__next_f.push([1,${JSON.stringify(
    nutrition ? payload : payload.replace('栄養成分表示', '成分'),
  )}])</script></html>`;
}

describe('BASEFOOD_CATEGORIES', () => {
  it('パン・ラーメン・焼きそばは主食', () => {
    expect(BASEFOOD_CATEGORIES.map(({ slug, role }) => [slug, role])).toEqual([
      ['basebread', 'main'],
      ['lite', 'main'],
      ['deli/baseramen', 'main'],
      ['deli/baseyakisoba', 'main'],
    ]);
  });
});

describe('parseProductLinks', () => {
  it('集めるカテゴリの商品ページだけを重複なく返す', () => {
    const html = [
      '/products/basebread/chocolate',
      '/products/basebread/chocolate',
      '/products/deli/baseramen/miso',
      '/products/basecookies/cocoa',
      '/products/basepancake/pancakemix',
      '/products/subscription/1',
      '/products',
    ]
      .map((path) => `<a href="${path}">x</a>`)
      .join('');
    expect(parseProductLinks(html)).toEqual([
      { path: '/products/basebread/chocolate', category: 'basebread' },
      { path: '/products/deli/baseramen/miso', category: 'deli/baseramen' },
    ]);
  });

  it('商品が 1 件も無ければ例外', () => {
    expect(() => parseProductLinks('<html></html>')).toThrow(
      '商品の一覧が読み取れません',
    );
  });
});

describe('parseProductPage', () => {
  it('商品名・SKU・単品の通常価格・1 袋あたりの栄養成分・商品ページの URL を読み取る', () => {
    expect(parseProductPage(page())).toEqual({
      id: '102008',
      name: 'BASE BREAD チョコレート',
      price: 255,
      url: 'https://shop.basefood.co.jp/products/basebread/chocolate',
      calories: 266,
      protein: 13.6,
      fat: 9.1,
      carbs: 35.4,
    });
  });

  it('1 個あたりの注記も販売単位として読む', () => {
    expect(
      parseProductPage(page({ note: '※BASE RAMEN 味噌ラーメン 1個あたり' })),
    ).toMatchObject({ calories: 266 });
  });

  it('栄養成分表示が無ければ例外', () => {
    expect(() => parseProductPage(page({ nutrition: false }))).toThrow(
      '栄養成分表示が読み取れません',
    );
  });

  it('栄養成分が 1 袋・1 個あたりでなければ例外', () => {
    expect(() => parseProductPage(page({ note: '※100gあたり' }))).toThrow(
      'の単位が読み取れません',
    );
  });

  it('商品情報が無ければ例外', () => {
    expect(() => parseProductPage(page({ product: false }))).toThrow(
      '商品情報が読み取れません',
    );
  });

  it('RSC ペイロードの無いページは例外', () => {
    expect(() => parseProductPage('<html></html>')).toThrow(
      'ページの商品情報が読み取れません',
    );
  });
});
