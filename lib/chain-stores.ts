/**
 * 公式サイトなどで栄養成分を公開しているチェーン店。
 * 近くのお店の判定と、AI に「栄養値を調べられるお店」として渡すのに使う。
 * aliases は OpenStreetMap の店名・ブランド名の表記ゆれ（正規化後に部分一致で判定する）。
 */
export const CHAIN_STORES = [
  {
    name: 'セブン-イレブン',
    kind: 'コンビニ',
    aliases: ['セブンイレブン', '7-eleven', 'seven-eleven', '7eleven'],
  },
  { name: 'ローソン', kind: 'コンビニ', aliases: ['ローソン', 'lawson'] },
  {
    name: 'ファミリーマート',
    kind: 'コンビニ',
    aliases: ['ファミリーマート', 'familymart', 'ファミマ'],
  },
  {
    name: 'ミニストップ',
    kind: 'コンビニ',
    aliases: ['ミニストップ', 'ministop'],
  },
  {
    name: 'デイリーヤマザキ',
    kind: 'コンビニ',
    aliases: ['デイリーヤマザキ', 'dailyyamazaki'],
  },
  { name: 'NewDays', kind: 'コンビニ', aliases: ['newdays', 'ニューデイズ'] },
  { name: 'まいばすけっと', kind: 'スーパー', aliases: ['まいばすけっと'] },
  { name: 'すき家', kind: '牛丼', aliases: ['すき家', 'sukiya'] },
  { name: '松屋', kind: '牛丼', aliases: ['松屋', 'matsuya'] },
  { name: '吉野家', kind: '牛丼', aliases: ['吉野家', 'yoshinoya'] },
  { name: 'なか卯', kind: '丼・うどん', aliases: ['なか卯', 'nakau'] },
  { name: '松のや', kind: 'とんかつ', aliases: ['松のや'] },
  {
    name: 'マクドナルド',
    kind: 'ハンバーガー',
    aliases: ['マクドナルド', "mcdonald's", 'mcdonalds'],
  },
  {
    name: 'モスバーガー',
    kind: 'ハンバーガー',
    aliases: ['モスバーガー', 'mosburger'],
  },
  {
    name: 'ケンタッキーフライドチキン',
    kind: 'フライドチキン',
    aliases: ['ケンタッキー', 'kfc'],
  },
  {
    name: 'サブウェイ',
    kind: 'サンドイッチ',
    aliases: ['サブウェイ', 'subway'],
  },
  {
    name: 'バーガーキング',
    kind: 'ハンバーガー',
    aliases: ['バーガーキング', 'burgerking'],
  },
  {
    name: 'フレッシュネスバーガー',
    kind: 'ハンバーガー',
    aliases: ['フレッシュネス', 'freshness'],
  },
  { name: '丸亀製麺', kind: 'うどん', aliases: ['丸亀製麺', 'marugame'] },
  {
    name: 'はなまるうどん',
    kind: 'うどん',
    aliases: ['はなまるうどん', 'hanamaru'],
  },
  {
    name: 'CoCo壱番屋',
    kind: 'カレー',
    aliases: ['coco壱番屋', 'ココイチ', 'cocoichibanya'],
  },
  { name: '大戸屋', kind: '定食', aliases: ['大戸屋', 'ootoya'] },
  { name: 'やよい軒', kind: '定食', aliases: ['やよい軒', 'yayoiken'] },
  { name: '日高屋', kind: '中華', aliases: ['日高屋', 'hidakaya'] },
  { name: '餃子の王将', kind: '中華', aliases: ['餃子の王将', '王将'] },
  {
    name: 'リンガーハット',
    kind: 'ちゃんぽん',
    aliases: ['リンガーハット', 'ringerhut'],
  },
  { name: '天丼てんや', kind: '天丼', aliases: ['てんや', 'tenya'] },
  {
    name: 'サイゼリヤ',
    kind: 'ファミレス',
    aliases: ['サイゼリヤ', 'saizeriya'],
  },
  { name: 'ガスト', kind: 'ファミレス', aliases: ['ガスト', 'gusto'] },
  { name: 'デニーズ', kind: 'ファミレス', aliases: ['デニーズ', "denny's"] },
  {
    name: 'ジョナサン',
    kind: 'ファミレス',
    aliases: ['ジョナサン', "jonathan's"],
  },
  {
    name: 'ほっともっと',
    kind: '弁当',
    aliases: ['ほっともっと', 'hottomotto'],
  },
  {
    name: 'オリジン弁当',
    kind: '弁当',
    aliases: ['オリジン弁当', 'キッチンオリジン', 'originbento'],
  },
  {
    name: 'スターバックス',
    kind: 'カフェ',
    aliases: ['スターバックス', 'starbucks'],
  },
  { name: 'ドトールコーヒー', kind: 'カフェ', aliases: ['ドトール', 'doutor'] },
  {
    name: 'タリーズコーヒー',
    kind: 'カフェ',
    aliases: ['タリーズ', "tully's", 'tullys'],
  },
  { name: 'コメダ珈琲店', kind: 'カフェ', aliases: ['コメダ', 'komeda'] },
  {
    name: 'エクセルシオールカフェ',
    kind: 'カフェ',
    aliases: ['エクセルシオール', 'excelsior'],
  },
  {
    name: 'ベックスコーヒーショップ',
    kind: 'カフェ',
    aliases: ['ベックス', "beck's", 'becks'],
  },
  {
    name: 'ミスタードーナツ',
    kind: 'ドーナツ',
    aliases: ['ミスタードーナツ', 'misterdonut'],
  },
  { name: '富士そば', kind: 'そば', aliases: ['富士そば'] },
  { name: 'ゆで太郎', kind: 'そば', aliases: ['ゆで太郎'] },
] as const satisfies readonly {
  name: string;
  kind: string;
  aliases: readonly string[];
}[];

const normalize = (value: string) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s・'’-]/g, '');

/** 店名・ブランド名に一致するチェーンの正式名。チェーンでなければ undefined。 */
export function findChainStore(
  ...names: (string | undefined)[]
): string | undefined {
  const targets = names.flatMap((name) => (name ? [normalize(name)] : []));
  return CHAIN_STORES.find((chain) =>
    chain.aliases.some((alias) =>
      targets.some((target) => target.includes(normalize(alias))),
    ),
  )?.name;
}
