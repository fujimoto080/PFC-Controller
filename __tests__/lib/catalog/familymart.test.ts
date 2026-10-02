import {
  combineItems,
  parseListPage,
  parseNutritionPage,
} from '@/lib/catalog/familymart';

/** 一覧ページの商品 1 件分の HTML。 */
function listItem(id: string, page: string, tags: string[], price: string) {
  const meta = JSON.stringify({
    tags: tags.map((tag) => `familymart:goods/category/${tag}`),
    salesArea: ['kanto'],
  }).replaceAll('"', '&#034;');
  return `
    <li class="ly-mod-layout-clm">
      <div class="ly-mod-infoset3 js-imgbox-size-rel">
        <input type="hidden" name="metaData" value="${meta}">
        <a href="https://www.family.co.jp/goods/${page}/${id}.html" class="ly-mod-infoset3-link">
          <p class="ly-mod-infoset3-name">商品</p>
          <p class="ly-mod-infoset3-price">
            276円
                （税込${price}円）
              </p>
        </a>
      </div>
    </li>`;
}

const ALL_AREAS = [
  '北海道',
  '東北',
  '関東',
  '東海',
  '北陸',
  '関西',
  '中国・四国',
  '九州',
  '沖縄',
];

/** 栄養成分ページの商品 1 件分の HTML。link が false なら商品ページへのリンクの無い副材。 */
function nutritionItem({
  id = '0410120',
  name = '手巻　辛子明太子',
  areas = ALL_AREAS,
  link = true,
  values = ['174.00', '4.00', '1.30', '37.00', '1.60'],
}: {
  id?: string;
  name?: string;
  areas?: string[];
  link?: boolean;
  values?: string[];
} = {}) {
  const areaTags = ALL_AREAS.map((area) =>
    areas.includes(area)
      ? `<li class="ly-mod-tag\n ly-mod-tag-area-on"><em>${area}</em></li>`
      : `<li class="ly-mod-tag\n ly-mod-tag-area-off">${area}</li>`,
  ).join('\n');
  return `
    <li><img src="/content/dam/family/goods/${id}.jpg" class="conL" alt=""/>
      <div class="item_basic_info">
        <p class="name">
          ${link ? `<a href="https://www.family.co.jp/goods/omusubi/${id}.html">${name}</a>` : name}
        </p>
        <dl>
          <dt class="areaT">対象地域</dt>
          <dd class="agn_goods_area"><ul>${areaTags}</ul></dd>
        </dl>
      </div>
      <table class="item_nutritional_info">
        <tbody>
          <tr>
            <th class="tit_nut">熱量<br>（kcal）</th>
            <th class="tit_nut">たんぱく質<br>（g）</th>
            <th class="tit_nut">脂質<br>（g）</th>
            <th class="tit_nut">炭水化物<br>（g）</th>
            <th class="tit_nut">食塩相当量<br>（g）</th>
          </tr>
          <tr>
            ${values.map((v) => `<td class="con_nut">${v}</td>`).join('\n')}
          </tr>
        </tbody>
      </table>
    </li>`;
}

describe('parseListPage', () => {
  it('商品番号・小分類の商品タグ・税込価格を読み取る', () => {
    const html =
      listItem('1022032', 'deli', ['deli', 'deli/soup'], '480') +
      listItem(
        '0410120',
        'omusubi',
        ['omusubi', 'omusubi/hand_rolled'],
        '1,058',
      );
    expect(parseListPage(html)).toEqual([
      { id: '1022032', tags: ['deli', 'deli/soup'], price: 480 },
      { id: '0410120', tags: ['omusubi', 'omusubi/hand_rolled'], price: 1058 },
    ]);
  });
});

describe('parseNutritionPage', () => {
  it('商品名・対象地域・栄養成分を読み取り、全地域なら販売地域を付けない', () => {
    expect(
      parseNutritionPage(
        nutritionItem() +
          nutritionItem({
            id: '0412001',
            name: '【関東の一部】ツナ＆マヨ',
            areas: ['関東', '中国・四国'],
          }),
      ),
    ).toEqual([
      {
        id: '0410120',
        name: '手巻 辛子明太子',
        url: 'https://www.family.co.jp/goods/omusubi/0410120.html',
        inTargetArea: true,
        calories: 174,
        protein: 4,
        fat: 1.3,
        carbs: 37,
      },
      {
        id: '0412001',
        name: '【関東の一部】ツナ&マヨ',
        url: 'https://www.family.co.jp/goods/omusubi/0412001.html',
        area: '関東、中国・四国',
        inTargetArea: true,
        calories: 174,
        protein: 4,
        fat: 1.3,
        carbs: 37,
      },
    ]);
  });

  it('関東で売っていない件は inTargetArea が false', () => {
    expect(
      parseNutritionPage(nutritionItem({ areas: ['北海道'] }))[0],
    ).toMatchObject({ area: '北海道', inTargetArea: false });
  });

  it('商品ページへのリンクの無い副材は除く', () => {
    expect(
      parseNutritionPage(
        nutritionItem({ name: 'タルタルソース', link: false }),
      ),
    ).toEqual([]);
  });

  it('栄養成分の表記が想定と違えば例外にする', () => {
    expect(() =>
      parseNutritionPage(
        nutritionItem({ values: ['174.00', '4.00', '1.30', '-', '1.60'] }),
      ),
    ).toThrow('0410120 の栄養成分の炭水化物が読み取れません');
  });
});

describe('combineItems', () => {
  const nutrition = (id: string, inTargetArea = true) => ({
    id,
    name: `商品${id}`,
    url: `https://www.family.co.jp/goods/deli/${id}.html`,
    inTargetArea,
    calories: 100,
    protein: 5,
    fat: 3,
    carbs: 10,
  });

  it('小分類でカテゴリに振り分け、栄養成分の無い商品・関東で売っていない商品・集めない小分類は除く', () => {
    expect(
      combineItems(
        [
          { id: '1', tags: ['deli', 'deli/soup'], price: 398 },
          { id: '2', tags: ['deli', 'deli/gratin'], price: 498 },
          { id: '3', tags: ['deli', 'deli/soup'], price: 398 },
          { id: '4', tags: ['deli', 'deli/other'], price: 398 },
        ],
        [nutrition('1'), nutrition('2', false), nutrition('4')],
      ),
    ).toEqual([
      {
        id: '1',
        name: '商品1',
        url: 'https://www.family.co.jp/goods/deli/1.html',
        category: 'deli/soup',
        price: 398,
        calories: 100,
        protein: 5,
        fat: 3,
        carbs: 10,
      },
    ]);
  });

  it('関東の栄養成分が複数あれば例外にする', () => {
    expect(() =>
      combineItems(
        [{ id: '1', tags: ['deli', 'deli/soup'], price: 398 }],
        [nutrition('1'), nutrition('1')],
      ),
    ).toThrow('1 の関東の栄養成分が複数あります');
  });
});
