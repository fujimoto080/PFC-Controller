import { findChainStore, normalizeStoreName } from './chain-stores';

/** チェーン店の正式名と、public/store-logos に置いたロゴ画像のファイル名（拡張子なし）。 */
const CHAIN_LOGOS: Record<string, string> = {
  'セブン-イレブン': 'seven',
  ローソン: 'lawson',
  ファミリーマート: 'familymart',
  ミニストップ: 'ministop',
  デイリーヤマザキ: 'daily-yamazaki',
  すき家: 'sukiya',
  松屋: 'matsuya',
  吉野家: 'yoshinoya',
  なか卯: 'nakau',
  松のや: 'matsunoya',
  マクドナルド: 'mcdonalds',
  モスバーガー: 'mos',
  ケンタッキーフライドチキン: 'kfc',
  サブウェイ: 'subway',
  バーガーキング: 'burgerking',
  フレッシュネスバーガー: 'freshness',
  丸亀製麺: 'marugame',
  はなまるうどん: 'hanamaru',
  CoCo壱番屋: 'coco',
  大戸屋: 'ootoya',
  やよい軒: 'yayoiken',
  日高屋: 'hidakaya',
  餃子の王将: 'ohsho',
  リンガーハット: 'ringerhut',
  天丼てんや: 'tenya',
  サイゼリヤ: 'saizeriya',
  デニーズ: 'dennys',
  ほっともっと: 'hottomotto',
  オリジン弁当: 'origin',
  スターバックス: 'starbucks',
  ドトールコーヒー: 'doutor',
  タリーズコーヒー: 'tullys',
  コメダ珈琲店: 'komeda',
  エクセルシオールカフェ: 'excelsior',
  ベックスコーヒーショップ: 'becks',
  ミスタードーナツ: 'misterdonut',
};

/** チェーン店ではないが、よく使うブランド（店名の表記ゆれ → ロゴ画像）。 */
const BRAND_LOGOS = [
  { aliases: ['savas', 'ザバス'], logo: 'savas' },
  { aliases: ['myprotein', 'マイプロテイン'], logo: 'myprotein' },
  { aliases: ['dns'], logo: 'dns' },
] as const;

/** 店名に一致するチェーン・ブランドのロゴ画像 URL。ロゴが無ければ undefined。 */
export function storeLogoUrl(store: string): string | undefined {
  const chain = findChainStore(store);
  const target = normalizeStoreName(store);
  const logo =
    (chain && CHAIN_LOGOS[chain]) ??
    BRAND_LOGOS.find(({ aliases }) =>
      aliases.some((alias) => target.includes(normalizeStoreName(alias))),
    )?.logo;
  return logo ? `/store-logos/${logo}.png` : undefined;
}
