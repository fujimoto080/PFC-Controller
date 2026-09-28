import { defineConfig, devices } from '@playwright/test';
import {
  E2E_AUTH_SECRET,
  E2E_BASE_URL,
  E2E_DATABASE_URL,
  E2E_PORT,
} from './e2e/env';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: E2E_BASE_URL,
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    trace: 'retain-on-failure',
    // Service Worker のキャッシュでテスト間の結果が変わらないようにする
    serviceWorkers: 'block',
  },
  projects: [{ name: 'mobile', use: { ...devices['Pixel 7'] } }],
  webServer: {
    // 本番と同じ挙動で確かめるため、開発サーバーではなくビルド成果物で動かす
    command: `pnpm build && pnpm start --port ${E2E_PORT}`,
    url: E2E_BASE_URL,
    timeout: 300_000,
    // .env.local より優先されるよう、E2E 用の DB と認証設定をプロセス環境変数で渡す
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      AUTH_SECRET: E2E_AUTH_SECRET,
      AUTH_URL: E2E_BASE_URL,
      AUTH_TRUST_HOST: 'true',
      AUTH_GOOGLE_ID: 'e2e',
      AUTH_GOOGLE_SECRET: 'e2e',
    },
  },
});
