#!/bin/sh
# Vercel の Ignored Build Step。前回デプロイからアプリに影響するファイルが変わっていなければビルドを省く。
# 終了コード 0 でスキップ、それ以外（差分あり・前回 SHA が取れない等）ではビルドする。
exec git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- . \
  ':(exclude).claude' \
  ':(exclude).github' \
  ':(exclude)__tests__' \
  ':(exclude)e2e' \
  ':(exclude)twa' \
  ':(exclude)docs' \
  ':(exclude)*.md' \
  ':(exclude)jest.config.ts' \
  ':(exclude)jest.setup.ts' \
  ':(exclude)playwright.config.ts' \
  ':(exclude)knip.json' \
  ':(exclude).oxlintrc.json' \
  ':(exclude).oxfmtrc.json' \
  ':(exclude)renovate.json' \
  ':(exclude)scripts/seed-sukiya-foods.mjs'
