import { findChainStore } from './chain-stores';

/** チェーン店の公式サイトのドメイン。ロゴ（favicon）の取得に使う。 */
const CHAIN_DOMAINS: Record<string, string> = {
  'セブン-イレブン': '7andi.com',
  ローソン: 'lawson.co.jp',
  ファミリーマート: 'family.co.jp',
  ミニストップ: 'ministop.co.jp',
  デイリーヤマザキ: 'daily-yamazaki.jp',
  NewDays: 'newdays.com',
  まいばすけっと: 'maibaskets.com',
  すき家: 'sukiya.jp',
  松屋: 'matsuyafoods.co.jp',
  吉野家: 'yoshinoya.com',
  なか卯: 'nakau.co.jp',
  松のや: 'matsunoya.jp',
  マクドナルド: 'mcdonalds.co.jp',
  モスバーガー: 'mos.jp',
  ケンタッキーフライドチキン: 'kfc.co.jp',
  サブウェイ: 'subway.co.jp',
  バーガーキング: 'burgerking.co.jp',
  フレッシュネスバーガー: 'freshnessburger.co.jp',
  丸亀製麺: 'marugame-seimen.com',
  はなまるうどん: 'hanamaruudon.com',
  CoCo壱番屋: 'ichibanya.co.jp',
  大戸屋: 'ootoya.com',
  やよい軒: 'yayoiken.com',
  日高屋: 'hidakaya.hiday.co.jp',
  餃子の王将: 'ohsho.co.jp',
  リンガーハット: 'ringerhut.co.jp',
  天丼てんや: 'tenya.co.jp',
  サイゼリヤ: 'saizeriya.co.jp',
  ガスト: 'skylark.co.jp',
  デニーズ: 'dennys.jp',
  ジョナサン: 'skylark.co.jp',
  ほっともっと: 'hottomotto.com',
  オリジン弁当: 'origin.co.jp',
  スターバックス: 'starbucks.co.jp',
  ドトールコーヒー: 'doutor.co.jp',
  タリーズコーヒー: 'tullys.co.jp',
  コメダ珈琲店: 'komeda.co.jp',
  エクセルシオールカフェ: 'excelsior-caffe.jp',
  ベックスコーヒーショップ: 'becks.co.jp',
  ミスタードーナツ: 'misterdonut.jp',
  富士そば: 'fujisoba.co.jp',
  ゆで太郎: 'yude.co.jp',
};

/** 店名に一致するチェーンのロゴ画像 URL。チェーンでなければ undefined。 */
export function storeLogoUrl(store: string): string | undefined {
  const chain = findChainStore(store);
  const domain = chain && CHAIN_DOMAINS[chain];
  return domain
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
    : undefined;
}
