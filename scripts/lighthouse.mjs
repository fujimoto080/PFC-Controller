#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';

// 使い方: LIGHTHOUSE_COOKIE='authjs.session-token=...' pnpm lighthouse [URL...]
// 本番ビルド（pnpm build && pnpm start）に対して計測する。結果は .lighthouse/ に出力する。
// Performance スコア（0〜1）が LIGHTHOUSE_MIN_SCORE を下回る URL があれば、全 URL を計測したあと異常終了する。
const BASE_URL = process.env.LIGHTHOUSE_BASE_URL ?? 'http://localhost:3000';
const PATHS = ['/', '/foods', '/suggest', '/settings'];
const OUTPUT_DIR = '.lighthouse';
const MIN_SCORE = Number(process.env.LIGHTHOUSE_MIN_SCORE ?? 0);

const cookie = process.env.LIGHTHOUSE_COOKIE;
if (!cookie) throw new Error('LIGHTHOUSE_COOKIE が未設定です');

const urls = process.argv.length > 2 ? process.argv.slice(2) : PATHS;
mkdirSync(OUTPUT_DIR, { recursive: true });

const failures = [];
for (const path of urls) {
  const url = new URL(path, BASE_URL).href;
  const name = new URL(url).pathname.replaceAll('/', '_') || '_';
  execFileSync(
    'pnpm',
    [
      'exec',
      'lighthouse',
      url,
      '--only-categories=performance',
      '--extra-headers',
      JSON.stringify({ Cookie: cookie }),
      '--output=html',
      '--output=json',
      `--output-path=${OUTPUT_DIR}/${name}`,
      '--chrome-flags=--headless=new',
      '--quiet',
    ],
    { stdio: 'inherit' },
  );
  const report = JSON.parse(
    readFileSync(`${OUTPUT_DIR}/${name}.report.json`, 'utf8'),
  );
  const score = report.categories.performance.score;
  console.log(
    `[lighthouse] ${url} performance=${Math.round(score * 100)} -> ${OUTPUT_DIR}/${name}.report.html`,
  );
  if (score < MIN_SCORE) failures.push(url);
}

if (failures.length > 0) {
  throw new Error(
    `Performance が ${MIN_SCORE * 100} を下回りました: ${failures.join(', ')}`,
  );
}
