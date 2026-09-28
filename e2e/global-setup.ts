import { execFileSync } from 'node:child_process';
import { E2E_DATABASE_URL } from './env';

/** テスト用 DB にスキーマを作る。各テストは自分専用のユーザーで動くため既存データは消さない。 */
export default function globalSetup() {
  execFileSync('node', ['scripts/migrate.mjs'], {
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
    stdio: 'inherit',
  });
}
