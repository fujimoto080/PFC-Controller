#!/usr/bin/env node
/**
 * すき家メニューの栄養成分データ (data/sukiya-foods.json) を
 * 一括インポート API (POST /api/foods/import) 経由で食品辞書へ投入する。
 *
 * DB に直接繋がず、稼働中のアプリの API を叩く（＝ API 経由で機械的に投入）。
 * food_id は決定的 (sukiya_NNN) なので再実行しても上書き更新される（冪等）。
 *
 * 必要な環境変数（.env.development.local / .env.local / .env from cwd を自動読込）:
 *   SEED_API_TOKEN     … サーバと共有する秘密トークン（サーバ側にも同値を設定）
 *   SEED_API_BASE_URL  … 省略時 http://localhost:3000
 *   SEED_USER_EMAIL    … 投入先ユーザーのメール（第1引数でも指定可）
 *
 * 使い方:
 *   pnpm seed:sukiya you@example.com
 *   # または SEED_USER_EMAIL=you@example.com pnpm seed:sukiya
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function loadEnv() {
  for (const file of ['.env.development.local', '.env.local', '.env']) {
    const p = path.join(process.cwd(), file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!m) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[m[1]] === undefined) process.env[m[1]] = val;
    }
  }
}

async function main() {
  loadEnv();
  const token = process.env.SEED_API_TOKEN?.trim();
  if (!token) throw new Error('SEED_API_TOKEN が未設定です');

  const email = (process.argv[2] || process.env.SEED_USER_EMAIL || '').trim();
  if (!email) throw new Error('投入先メールを引数か SEED_USER_EMAIL で指定してください');

  const baseUrl = (process.env.SEED_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const foods = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'sukiya-foods.json'), 'utf8'));

  const url = `${baseUrl}/api/foods/import`;
  console.log(`[seed] ${url} へ ${foods.length} 件を投入します (user=${email})...`);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ email, foods }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`API エラー (${res.status}): ${text}`);
  }
  const data = JSON.parse(text);
  console.log(`[seed] 完了: ${data.count} 件を upsert しました`);
}

main().catch((error) => {
  console.error('[seed] 失敗:', error.message ?? error);
  process.exit(1);
});
