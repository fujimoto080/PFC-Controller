import { parseMenuListPage, parseMenuPage } from '@/lib/catalog/matsuya';

const nutrition = (kcal: string) =>
  `<p>カロリー／${kcal}kcal<br>たんぱく質／13.1g<br>脂質／22.8g<br>炭水化物／59.6g<br>食塩相当量／2.6g</p>`;

/** 商品ページ。prices は [サイズ, 価格]（サイズ無しは空文字）、sizes は [サイズ, kcal] */
const menuPage = (prices: [string, string][], sizes?: [string, string][]) => `
<h1 class="ttl">牛めし</h1>
<ul class="ul-text">
${prices
  .map(
    ([size, price]) => `<li>
${size === '' ? '' : `<p class="th">${size}</p>`}
<p class="td"><span class="clr">${price}</span><span class="clr fs">円</span><span class="fs">(税込)</span></p>
</li>`,
  )
  .join('\n')}
</ul>
${
  sizes === undefined
    ? ''
    : `<div class="nourishment"><ul class="ul-col flex">
${sizes.map(([size, kcal]) => `<li><h3 class="txt">${size}</h3>${nutrition(kcal)}</li>`).join('\n')}
</ul></div>`
}`;

describe('parseMenuListPage', () => {
  it('同じカテゴリの商品ページだけを重複なく返す', () => {
    const html = `
<a href="https://www.matsuyafoods.co.jp/menu/../matsuya/menu/curry/beef_hp_260728.html">
<a href="https://www.matsuyafoods.co.jp/menu/../matsuya/menu/curry/beef_hp_260728.html">
<a href="/matsuya/menu/curry/index.html">
<a href="/matsuya/menu/don/don_hp.html">`;
    expect(parseMenuListPage(html, 'curry')).toEqual([
      'https://www.matsuyafoods.co.jp/matsuya/menu/curry/beef_hp_260728.html',
    ]);
  });
});

describe('parseMenuPage', () => {
  it('サイズごとの価格と栄養成分を読む', () => {
    const html = menuPage(
      [
        ['小盛', '430'],
        ['並盛', '460'],
      ],
      [
        ['小盛', '507'],
        ['並盛', '687'],
      ],
    );
    expect(parseMenuPage(html)).toEqual({
      name: '牛めし',
      variants: [
        {
          size: '小盛',
          price: 430,
          calories: 507,
          protein: 13.1,
          fat: 22.8,
          carbs: 59.6,
        },
        {
          size: '並盛',
          price: 460,
          calories: 687,
          protein: 13.1,
          fat: 22.8,
          carbs: 59.6,
        },
      ],
    });
  });

  it('サイズの表記が無い既定の価格と栄養成分を突き合わせ、価格が載っていないサイズは価格無しにする', () => {
    const html = menuPage(
      [
        ['', '880'],
        ['単品', '680'],
      ],
      [
        ['', '906'],
        ['ダブル', '1409'],
        ['単品', '502'],
      ],
    );
    expect(
      parseMenuPage(html).variants.map(({ size, price }) => [size, price]),
    ).toEqual([
      ['', 880],
      ['ダブル', undefined],
      ['単品', 680],
    ]);
  });

  it('栄養成分の欄が無い商品は variants が空', () => {
    expect(parseMenuPage(menuPage([['', '100']]))).toEqual({
      name: '牛めし',
      variants: [],
    });
  });

  it('商品名が読めなければ例外にする', () => {
    expect(() => parseMenuPage('<html></html>')).toThrow(
      '商品名が読み取れません',
    );
  });

  it('栄養成分の欄があるのに読めなければ例外にする', () => {
    expect(() =>
      parseMenuPage(
        '<h1 class="ttl">牛めし</h1><div class="nourishment"><ul></ul></div>',
      ),
    ).toThrow('牛めしの栄養成分が読み取れません');
    expect(() =>
      parseMenuPage(
        '<h1 class="ttl">牛めし</h1><div class="nourishment"><ul><li><h3 class="txt"></h3><p>カロリー／507kcal</p></li></ul></div>',
      ),
    ).toThrow('栄養成分のたんぱく質が読み取れません');
  });
});
