import type { MealSlot, PFC } from '../types';

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

/** 組み合わせ提案の商品。メーカーの既製品なら maker にメーカー名。 */
export interface CombinationItem extends CatalogItem {
  maker?: string;
}

/** 組み合わせ提案 API（GET /api/combination-suggestions）の応答。 */
export interface CombinationSuggestions {
  store: string;
  slot: MealSlot;
  /** この食事の目安（今日の残りを今日これからの食事の数で等分） */
  target: PFC;
  combinations: {
    items: CombinationItem[];
    total: PFC;
    /** 合計の税込価格。価格の分からない商品を含むなら無し */
    price?: number;
  }[];
}
