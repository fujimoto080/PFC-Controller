import type { PFC } from '../types';

/** data/<店舗 ID>.json の 1 件。お店の公式サイトから機械的に読み取った商品。 */
export interface CatalogItem extends PFC {
  /** お店の中で一意な ID（公式サイトの商品番号など） */
  id: string;
  name: string;
  /** CatalogCategory の slug */
  category: string;
  /** 税込価格（円）。公式サイトに載っていなければ無し */
  price?: number;
  /** 販売地域（公式サイトの表記のまま）。全店共通なら無し */
  area?: string;
  /** 公式サイトの商品ページ（無ければ栄養成分の一覧ページ） */
  url: string;
  /** JAN コード（バーコードの数字）。サイズ違いをまとめた商品は複数。公式サイトに載っていなければ無し */
  jans?: string[];
}

/**
 * 商品カテゴリ。label は画面に出す名前。
 * role は組み合わせ提案での役割で、主食（main）1 品に副菜（side）を足して 1 食にする。
 */
export interface CatalogCategory {
  slug: string;
  label: string;
  role: 'main' | 'side';
}
