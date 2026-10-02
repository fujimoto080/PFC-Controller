# 商品カタログに店舗を追加する

組み合わせ提案 API（`GET /api/combination-suggestions`）と商品カタログ画面（`/catalog`）は、お店の公式サイトから集めた商品の栄養成分 `data/<店舗 ID>.json` を使う。機能の仕様は [`features.md`](features.md) の「11.4 商品の組み合わせ提案 API」を参照。

## 方針

- **AI を使わず機械的に読む。** HTML・埋め込み JSON・PDF の決まった表記を正規表現や座標で読み取る。推定や補完はしない
- **読めないものは失敗させる。** 栄養成分が載っていない商品は除くが、載っているのに読めない場合はページの形が変わったとみなして例外にする。黙って欠けたデータを書き出さない
- **1 食の単位になる物だけを集める。** 菓子・飲料・アイス・複数個入りの袋パン・重さ当たりしか分からない物などは、組み合わせても食事にならないので集めない
- **関東で買える物に絞る。** 地域で品ぞろえが違うお店は関東の物だけにし、`scope: '関東'` を付ける
- **サイトに負荷をかけない。** robots.txt を確認し、同時接続は 4 件程度まで（`mapConcurrent`）
- **新しい依存は最小限にする。** PDF でしか公開していない場合などに限り、保守されているライブラリを devDependency に入れる（すき家の unpdf）

## 構成

| ファイル                               | 役割                                                                                                                    |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `lib/catalog/types.ts`                 | 商品 `CatalogItem` とカテゴリ `CatalogCategory` の型                                                                    |
| `lib/catalog/scrape.ts`                | 共通部品。`fetchText` / `fetchBytes`（リトライ付き取得）、`mapConcurrent`、`normalizeText`、`toNumber`、`matchRequired` |
| `lib/catalog/<店舗 ID>.ts`             | お店ごとのカテゴリ定義・パース関数・`scrape<店舗>()`                                                                    |
| `scripts/scrape-catalog.ts`            | 店舗 ID → scrape 関数の `SCRAPERS`。結果を検査して `data/<店舗 ID>.json` に書き出す                                     |
| `lib/catalog/stores.ts`                | アプリ側の店舗一覧 `CATALOG_STORES`（JSON を import する）                                                              |
| `.github/workflows/scrape-catalog.yml` | 毎週月曜 4:00 JST に全店を取り直し、変わっていれば main にコミットする                                                  |

`lib/catalog/<店舗 ID>.ts` と `scrape.ts` は `scripts/scrape-catalog.ts` から Node の type stripping で直接実行される。そのため `@/` の import は使えない。値は `./scrape.ts` のように拡張子付きの相対パスで import し、型は `import type` で読む。

## 手順

### 1. 公式サイトを調べる

- 商品名・カテゴリ・kcal / たんぱく質 / 脂質 / 炭水化物・税込価格・販売地域・商品ページの URL が、どのページにどの形で載っているかを探す
- 個別の商品ページより、栄養成分の一覧ページや、ページに埋め込まれた構造化データ（Next.js の RSC ペイロードなど）の方が少ない取得で確実に読めることが多い
- 取得は `node -e "fetch(...)"` で試す。生の HTML を確かめるときは、要約されてしまう WebFetch ではなく node を使う

既存の実装は読み取り方ごとに参考にできる。

| 店舗 ID        | 読み取り元                                                     | 参考になる点                                                 |
| -------------- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| `seven-eleven` | 関東の一覧ページをたどり、商品ページの定型文を読む             | 一覧のページ送り・小分類のたどり方                           |
| `lawson`       | 一覧ページと商品ページ                                         | 取り扱い地域の注記から関東で買えない物を除く `isSoldInKanto` |
| `familymart`   | 商品一覧と栄養成分ページを商品番号で突き合わせる               | 2 種類のページの結合、地域版の選び方                         |
| `origin`       | メニューページに埋め込まれた RSC ペイロード                    | 1 回の取得で全商品を読む                                     |
| `sukiya`       | 栄養成分の PDF（unpdf で文字の座標を取る）と店内メニューの価格 | PDF の表を座標で組み立てる、名前とサイズで価格を突き合わせる |

### 2. `lib/catalog/<店舗 ID>.ts` を作る

- `<店舗>_CATEGORIES` を `as const satisfies readonly CatalogCategory[]` で定義する
  - `slug` はサイトの URL やカテゴリ名をそのまま使う
  - `label` は画面に出す名前
  - `role` は主食なら `'main'`、副菜なら `'side'`。提案は主食 1 品に副菜 0〜2 品を組み合わせる
  - 集めないカテゴリとその理由はコメントに書く
- パース関数は、HTML などの文字列を受け取って結果を返す純粋関数にして export し、テストする
- `scrape<店舗>(): Promise<CatalogItem[]>` で取得とパースをつなぐ
- `CatalogItem` の各項目は次のように作る
  - `id`: 毎回同じになるようにする。サイトの商品番号など。サイズ違いを別商品にするなら名前とサイズを含める
  - `name`: `normalizeText` で表記を揃える
  - `price`: 税込で円未満を四捨五入する。サイトに無ければ省く
  - `area`: 販売地域や取り扱いの注記。全店共通なら省く
  - `url`: 商品ページ。無ければ栄養成分の一覧ページ
- 複数のカテゴリに載る商品は、最初のカテゴリに入れて重複させない（ID の重複は書き出し時にエラーになる）
- カテゴリごとの件数は確かめない。おでん・中華まんのように季節で空になるカテゴリがあるため

### 3. 登録する

1. `scripts/scrape-catalog.ts` の `SCRAPERS` に `'<店舗 ID>': scrape<店舗>` を足す
2. `pnpm scrape:catalog <店舗 ID>` で `data/<店舗 ID>.json` を作る
3. `lib/catalog/stores.ts` の `CATALOG_STORES` に `{ id, name, scope?, categories, items }` を足す。JSON は `@/data/<店舗 ID>.json` から import する

書き出し時に、次の場合はそのお店を失敗にして JSON を書き換えない。

- 1 件も取れなかった
- ID が重複している
- 前回より 2 割以上件数が減った

一部のお店が失敗しても、他のお店は書き出す。

### 4. 確かめる

- 生成した JSON のカテゴリごとの件数を見て、数件の価格と PFC が公式の表記と一致するかを突き合わせる
- `__tests__/lib/catalog/<店舗 ID>.test.ts` にパース関数のテストを書く。HTML の一部を切り出したフィクスチャで、正常に読める場合・栄養成分の無い商品・形が違って例外になる場合を確かめる
- `features.md` の 11.4「対応店舗」に、読み取り元と集めないものの理由を追記する
- `pnpm exec tsc --noEmit && pnpm lint && pnpm format:check && pnpm knip && pnpm test` を通す。依存を足したときは `pnpm build` も通し、`lib/catalog/stores.ts` 経由でアプリに取り込まれても問題ないか確かめる

### 5. 週次の更新

`scripts/scrape-catalog.ts` は登録した全店を順に取り直す。そのためワークフローを変える必要は無い。依存を足した場合も、ワークフローには `pnpm install --frozen-lockfile` があるのでそのまま動く。手動で取り直すときは、Actions 画面から `Update catalog` を実行する。
