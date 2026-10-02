import { parseProductList, parseProductPage } from '@/lib/catalog/nissin';

/** 商品ページ上部の表（希望小売価格・内容量・発売地域）。 */
function infoTable(rows: Record<string, string>) {
  const trs = Object.entries(rows)
    .map(
      ([th, td]) =>
        `<tr> <th class="w-[171px]">${th}</th> <td> ${td} </td> </tr>`,
    )
    .join('');
  return `<table class="Table simple"> <tbody> ${trs} </tbody> </table>`;
}

/** 栄養成分表示のブロック（めん・かやく / スープに分かれた熱量つき）。 */
const nutritionSplit = `
<h2 class="Text">栄養成分表示　[1食 (78g) 当たり]</h2>
<table class="Table nutrition"><tbody>
<tr class="with-breakdown"> <th colspan="2"> 熱量 </th> <td>364kcal</td> </tr>
<tr class="is-breakdown"> <th>&nbsp;</th> <th>めん・かやく</th> <td>349kcal</td> </tr>
<tr class="is-breakdown"> <th>&nbsp;</th> <th>スープ</th> <td>15kcal</td> </tr>
<tr> <th colspan="2"> たんぱく質 </th> <td>10.7g</td> </tr>
<tr> <th colspan="2"> 脂質 </th> <td>15.6g</td> </tr>
<tr> <th colspan="2"> 炭水化物 </th> <td>45.1g</td> </tr>
<tr class="with-breakdown"> <th colspan="2"> 食塩相当量 </th> <td>4.6g</td> </tr>
</tbody></table>`;

const info = {
  希望小売価格: '248円 (税別)',
  '内容量 (麺量)': '78g (65g)',
  発売地域: '全国',
};

describe('parseProductList', () => {
  const list = `
<div class="Heading__inner"> 即席麺 </div> </h2>
<div class="ProductsGrid"><h2 class="CardProductsHead"><span>カップ麺</span></h2>
<div class="CardProducts"> <a href="/jp/product/items/13462/" class="CardProducts__link">
<div class="CardProducts__content"> <div class="CardProducts__title">カップヌードル</div> </div> </a> </div>
<div class="CardProducts"> <a href="/jp/product/items/13264/" class="CardProducts__link">
<div class="CardProducts__content"> <div class="CardProducts__title">日清のどん兵衛　きつねうどん</div> </div> </a> </div></div>
<div class="Heading__inner"> スープ </div> </h2>
<div class="CardProducts"> <a href="/jp/product/items/12576/" class="CardProducts__link">
<div class="CardProducts__content"> <div class="CardProducts__title">まかないスープ</div> </div> </a> </div>
<div class="Heading__inner"> 菓子 </div> </h2>
<div class="CardProducts"> <a href="/jp/product/items/1/" class="CardProducts__link">
<div class="CardProducts__content"> <div class="CardProducts__title">ビスケット</div> </div> </a> </div>`;

  it('集めるカテゴリの商品の番号・名前・カテゴリを読み取り、菓子などは除く', () => {
    expect(parseProductList(list)).toEqual([
      { id: '13462', name: 'カップヌードル', category: '即席麺' },
      { id: '13264', name: '日清のどん兵衛 きつねうどん', category: '即席麺' },
      { id: '12576', name: 'まかないスープ', category: 'スープ' },
    ]);
  });

  it('商品が 1 件も読めなければ例外にする', () => {
    expect(() => parseProductList('<html></html>')).toThrow(
      '商品の一覧が読み取れません',
    );
  });
});

describe('parseProductPage', () => {
  it('熱量が分かれていても合計の栄養成分と、税込の価格を読み取る', () => {
    expect(parseProductPage(infoTable(info) + nutritionSplit)).toEqual({
      calories: 364,
      protein: 10.7,
      fat: 15.6,
      carbs: 45.1,
      price: 268,
    });
  });

  it('値が改行で区切られた形の表も読み取る', () => {
    const html =
      infoTable({ ...info, '内容量 (麺量)': '23g' }) +
      `<h2>栄養成分表示　[1食 (23g) 当たり]</h2>
<table class="Table nutrition"><tbody>
<tr> <th>熱量</th> <td>
107kcal
<br>めん・かやく: 88kcal
<br>スープ: 19kcal
</td> </tr>
<tr> <th>たんぱく質</th> <td> 2.3g </td> </tr>
<tr> <th>脂質</th> <td> 4.5g </td> </tr>
<tr> <th>炭水化物</th> <td> 14.4g </td> </tr>
</tbody></table>`;
    expect(parseProductPage(html)).toMatchObject({
      calories: 107,
      protein: 2.3,
      fat: 4.5,
      carbs: 14.4,
      price: 268,
    });
  });

  it('内容量が 1 食の重さと違う複数食入りとオープンプライスは価格を省く', () => {
    const multi = parseProductPage(
      infoTable({ ...info, '内容量 (麺量)': '234g (195g)' }) + nutritionSplit,
    );
    expect(multi).toMatchObject({ calories: 364 });
    expect(multi).not.toHaveProperty('price');
    const open = parseProductPage(
      infoTable({ ...info, 希望小売価格: 'オープンプライス' }) + nutritionSplit,
    );
    expect(open).not.toHaveProperty('price');
  });

  it('全国以外の関東で買える発売地域は地域を残す', () => {
    const html =
      infoTable({ ...info, 発売地域: '東日本 (北海道を除く)' }) +
      nutritionSplit;
    expect(parseProductPage(html)).toMatchObject({
      area: '東日本 (北海道を除く)',
    });
  });

  it('関東で買えない発売地域の商品は除く', () => {
    for (const area of ['西日本', '北海道', '全国 (関東を除く)']) {
      expect(
        parseProductPage(
          infoTable({ ...info, 発売地域: area }) + nutritionSplit,
        ),
      ).toBeUndefined();
    }
  });

  it('栄養成分が載っていない商品は除く', () => {
    expect(parseProductPage(infoTable(info))).toBeUndefined();
  });

  it('栄養成分が複数載っている詰め合わせは除く', () => {
    expect(
      parseProductPage(infoTable(info) + nutritionSplit + nutritionSplit),
    ).toBeUndefined();
  });

  it('栄養成分の単位が 1 食でなければ例外にする', () => {
    expect(() =>
      parseProductPage(
        infoTable(info) +
          nutritionSplit.replace('1食 (78g) 当たり', '100g 当たり'),
      ),
    ).toThrow('栄養成分の単位が読み取れません');
  });

  it('栄養成分の項目が無ければ例外にする', () => {
    expect(() =>
      parseProductPage(
        infoTable(info) + nutritionSplit.replace('脂質', '脂肪'),
      ),
    ).toThrow('脂質が読み取れません');
  });

  it('価格の表記が違えば例外にする', () => {
    expect(() =>
      parseProductPage(
        infoTable({ ...info, 希望小売価格: '248円 (税込)' }) + nutritionSplit,
      ),
    ).toThrow('希望小売価格が読み取れません');
  });
});
