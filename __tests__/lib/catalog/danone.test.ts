import {
  parseBioList,
  parseBioPage,
  parseDanoneYogurt,
  parseOikos,
} from '@/lib/catalog/danone';

const oikosModal = (
  id: string,
  title: string,
  heading: string,
  content: string,
) => `
<div id="${id}" class="modal_box">
  <div class="modal_products__body">
    <div class="modal_products__header pc-only">
      <h3 class="modal_products__header__title">${title}</h3>
    </div>
    <div class="eiyou">
      <h4>栄養成分表示<span>${heading}</span></h4>
      <ul>
        <li>エネルギー：95kcal</li>
        <li>脂質：0g</li>
        <li>たんぱく質：11.0g</li>
        <li>炭水化物：12.4g - 糖類：9.0g</li>
      </ul>
    </div>
    <p class="product_info">内容量：${content}　種類別名称：発酵乳</p>
  </div>
</div>`;

describe('parseOikos', () => {
  const html = `
<div id="movie" class="modal_box"><p>動画</p></div>
<!-- ${oikosModal('old', '終売', '1カップ(100g)あたり', '100g')} -->
${oikosModal('plane', '高吸収タンパク質 プレーン・加糖', '1カップ(123g)あたり', '123g')}
${oikosModal('drink-cacao', 'カカオ<br>高吸収タンパク質', '※1本（240ml）あたり', '240ml')}`;

  it('ヨーグルトとドリンクを読み取り、栄養成分の無いモーダルとコメントアウトを除く', () => {
    expect(parseOikos(html)).toEqual([
      {
        id: 'oikos-plane',
        name: 'オイコス 高吸収タンパク質 プレーン・加糖',
        category: 'yogurt',
        calories: 95,
        protein: 11,
        fat: 0,
        carbs: 12.4,
      },
      {
        id: 'oikos-drink-cacao',
        name: 'オイコス カカオ 高吸収タンパク質',
        category: 'drink',
        calories: 95,
        protein: 11,
        fat: 0,
        carbs: 12.4,
      },
    ]);
  });

  it('栄養成分の単位が読めなければ例外にする', () => {
    expect(() =>
      parseOikos(oikosModal('plane', '名前', '100gあたり', '100g')),
    ).toThrow('栄養成分の単位が読み取れません');
  });

  it('商品が 1 つも読めなければ例外にする', () => {
    expect(() => parseOikos('<html></html>')).toThrow();
  });
});

const danoneSection = (id: string, name: string, content: string) => `
<section id="${id}" class="p-section a-bg">
  <h2 class="o-productbox_ttl">${name}</h2>
  <dl><dt><span>内容量</span></dt><dd><span>${content}</span></dd></dl>
  <h3>栄養成分表示
    <span> 1カップ (70g) あたり</span>
  </h3>
  <ul>
    <li><p><span>エネルギー</span>43kcal</p></li>
    <li>
      <span>たんぱく質</span>2.4g</li>
    <li><p><span>脂質</span>1.2g</p></li>
    <li><p><span>炭水化物</span>5.8g</p></li>
  </ul>
</section>`;

describe('parseDanoneYogurt', () => {
  it('4 カップ入りの 1 カップ分の値で読み取り、コメントアウトされた商品を除く', () => {
    const html = `${danoneSection('plain', 'ダノンヨーグルト プレーン', '280g (70g x 4 カップ )')}
<!-- ${danoneSection('vanilla', 'バニラ', '280g (70g x 4 カップ )')} -->`;
    expect(parseDanoneYogurt(html)).toEqual([
      {
        id: 'danone-plain',
        name: 'ダノンヨーグルト プレーン(4カップ入りの1カップ)',
        category: 'yogurt',
        calories: 43,
        protein: 2.4,
        fat: 1.2,
        carbs: 5.8,
      },
    ]);
  });

  it('内容量が栄養成分の単位と合わなければ例外にする', () => {
    expect(() =>
      parseDanoneYogurt(
        danoneSection('plain', '名前', '280g (75g x 4 カップ )'),
      ),
    ).toThrow('内容量が読み取れません');
  });
});

describe('parseBioList', () => {
  const list = `
<ul class="lineup-list">
  <li class="filtPlane"><a href="plain/"><dl><dd><p>プレーン・加糖</p><em>プレーン</em></dd></dl></a></li>
  <li class="filtKoredake"><a href="zeitaku_5fruits/"><dl><dd><p>贅沢5種のフルーツ</p><em>腸活これだけ</em></dd></dl></a></li>
  <li class="filtDrink"><a href="drink-plain/"><dl><dd><p>プレーン</p><em>脂肪燃焼ヨーグルトドリンク</em></dd></dl></a></li>
  <!-- <li class="filtFruits"><a href="old/"><dl><dd><p>旧商品</p><em>フルーツ</em></dd></dl></a></li> -->
</ul>`;

  it('商品ページの slug・名前・カテゴリを読み取る', () => {
    expect(parseBioList(list)).toEqual([
      { slug: 'plain', name: 'ダノン ビオ プレーン・加糖', category: 'yogurt' },
      {
        slug: 'zeitaku_5fruits',
        name: 'ダノン ビオ 腸活これだけ 贅沢5種のフルーツ',
        category: 'yogurt',
      },
      {
        slug: 'drink-plain',
        name: 'ダノン ビオ 脂肪燃焼ヨーグルトドリンク プレーン',
        category: 'drink',
      },
    ]);
  });

  it('商品が 1 つも読めなければ例外にする', () => {
    expect(() => parseBioList('<html></html>')).toThrow();
  });
});

describe('parseBioPage', () => {
  const page = (content: string, heading: string) => `
<p class="font-green">●内容量：${content}</p>
<section class="seibun-block">
  <h3>栄養成分表示<span>${heading}</span></h3>
  <dl><dt>エネルギー（kcal）</dt><dd>66kcal</dd></dl>
  <dl><dt>たんぱく質（g） </dt><dd>3.2g</dd></dl>
  <dl><dt>脂質（g）</dt><dd>1.6g</dd></dl>
  <dl><dt>炭水化物（g） </dt><dd>10.2g</dd></dl>
</section>`;

  it('1 カップ分の栄養成分と入り数の注記を読み取る', () => {
    expect(
      parseBioPage(page('300g（75g×4カップ）', '※1カップ（75g）あたり')),
    ).toEqual({
      calories: 66,
      protein: 3.2,
      fat: 1.6,
      carbs: 10.2,
      note: '（4カップ入りの1カップ）',
    });
  });

  it('1 個入りなら注記は空', () => {
    expect(parseBioPage(page('100g', '※1本（100g）あたり'))?.note).toBe('');
  });

  it('栄養成分が無ければ undefined', () => {
    expect(parseBioPage('<p>●内容量：100g</p>')).toBeUndefined();
  });

  it('栄養成分の単位が読めなければ例外にする', () => {
    expect(() => parseBioPage(page('100g', '100gあたり'))).toThrow(
      '栄養成分の単位が読み取れません',
    );
  });
});
