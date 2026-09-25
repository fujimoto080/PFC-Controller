# AGENTS.md

## 言語

- 応答は必ず日本語で行うこと
- コードコメントも日本語で書くこと

## コーディング方針

- 重複するコードは共通化すること
- 使用しない機能・変数・ファイルは削除すること

## 検証

変更後は以下がすべて通ることを確認する。

```sh
pnpm exec tsc --noEmit
pnpm lint
pnpm format:check
pnpm knip
pnpm test
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
