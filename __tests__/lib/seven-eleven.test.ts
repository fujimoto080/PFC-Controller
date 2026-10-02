import { parseItemPage, parseListPage } from '@/lib/seven-eleven';

/** 公式サイトの商品ページから必要な部分だけを抜き出した HTML。 */
function itemPage(nutrition?: string) {
  return `
    <div class="item_ttl">
      <h1>手巻おにぎり　炭火焼銀しゃけ</h1><!-- ###gTop[132909]### -->
    </div>
    <div class="item_price">
      <p>198円（税込213.84円）</p>
    </div>
    <div class="item_region">
      <p><span>販売地域：</span>関東、甲信越</p>
    </div>
    <table><tbody>
      <tr><th>本製品に含まれるアレルギー物質</th><td>なし</td></tr>
      ${nutrition === undefined ? '' : `<tr>\n<th>栄養成分</th>\n<td>${nutrition}</td>\n</tr>`}
    </tbody></table>`;
}

describe('parseItemPage', () => {
  it('商品名・税込価格・販売地域・栄養成分を読み取る', () => {
    expect(
      parseItemPage(
        itemPage(
          '熱量：1,028kcal、たんぱく質：38.6g、脂質：56.9g、炭水化物：94.8g（糖質：85.7g、食物繊維：9.1g）、食塩相当量：7.5g',
        ),
      ),
    ).toEqual({
      name: '手巻おにぎり 炭火焼銀しゃけ',
      price: 214,
      area: '関東、甲信越',
      calories: 1028,
      protein: 38.6,
      fat: 56.9,
      carbs: 94.8,
    });
  });

  it('栄養成分を載せていない商品は undefined', () => {
    expect(parseItemPage(itemPage())).toBeUndefined();
  });

  it('栄養成分の表記が想定と違えば例外にする', () => {
    expect(() =>
      parseItemPage(itemPage('熱量：182kcal、たんぱく質：4.5g、脂質：2.7g')),
    ).toThrow('栄養成分の炭水化物が読み取れません');
  });
});

describe('parseListPage', () => {
  it('商品番号と、カテゴリ内の一覧ページを関東に揃えて返す', () => {
    const html = `
      <a href="/products/a/item/041249/kanto/">a</a>
      <a href="/products/a/item/041249/kanto/">a</a>
      <a href="/products/a/item/044678/">b</a>
      <a href="/products/a/cat/010010010000000/kanto/">手巻</a>
      <a href="/products/a/cat/150010000000000/">冷凍</a>
      <a href="/products/a/onigiri/kanto/2/l15/">2</a>
      <a href="/products/a/onigiri/kinki/">近畿</a>
      <a href="/products/a/hotsnack/">ホットスナック</a>`;
    expect(parseListPage(html, 'onigiri')).toEqual({
      itemIds: ['041249', '044678'],
      listUrls: [
        'https://www.sej.co.jp/products/a/cat/010010010000000/kanto/',
        'https://www.sej.co.jp/products/a/cat/150010000000000/kanto/',
        'https://www.sej.co.jp/products/a/onigiri/kanto/2/l15/',
      ],
    });
  });
});
