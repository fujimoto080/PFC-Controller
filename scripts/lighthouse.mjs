#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

// 使い方: LIGHTHOUSE_COOKIE='authjs.session-token=...' pnpm lighthouse [URL...]
// 本番ビルド（pnpm build && pnpm start）に対して計測する。結果は .lighthouse/ に HTML で出力する。
const BASE_URL = process.env.LIGHTHOUSE_BASE_URL ?? 'http://localhost:3000';
const PATHS = ['/', '/foods', '/suggest', '/settings'];
const OUTPUT_DIR = '.lighthouse';

const cookie = process.env.LIGHTHOUSE_COOKIE;
if (!cookie) throw new Error('LIGHTHOUSE_COOKIE が未設定です');

const urls = process.argv.length > 2 ? process.argv.slice(2) : PATHS;
mkdirSync(OUTPUT_DIR, { recursive: true });

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
  console.log(`[lighthouse] ${url} -> ${OUTPUT_DIR}/${name}.report.html`);
}
