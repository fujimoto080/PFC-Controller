import { randomUUID } from 'node:crypto';
import { test as base, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import pg from 'pg';
import { E2E_AUTH_SECRET, E2E_BASE_URL, E2E_DATABASE_URL } from './env';

// http で動かすため __Secure- プレフィックスの無い Cookie 名になる
const SESSION_COOKIE = 'authjs.session-token';

/**
 * テストごとに新しいユーザーを作り、そのユーザーでログイン済みのセッション Cookie を付ける。
 * Google ログインを経由せず、アプリと同じ AUTH_SECRET で JWT セッションを発行する。
 */
export const test = base.extend<{ userId: string }>({
  userId: [
    async ({ context }, provide) => {
      const userId = randomUUID();
      const client = new pg.Client({ connectionString: E2E_DATABASE_URL });
      await client.connect();
      try {
        await client.query(
          'INSERT INTO users (id, name, email) VALUES ($1, $2, $3)',
          [userId, 'E2E ユーザー', `${userId}@e2e.test`],
        );
        const token = await encode({
          token: { id: userId, sub: userId },
          secret: E2E_AUTH_SECRET,
          salt: SESSION_COOKIE,
        });
        await context.addCookies([
          { name: SESSION_COOKIE, value: token, url: E2E_BASE_URL },
        ]);
        await provide(userId);
      } finally {
        await client.query('DELETE FROM users WHERE id = $1', [userId]);
        await client.end();
      }
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';

/** ホームの「食べたもの」一覧。 */
export function dayLogList(page: Page) {
  return page.locator('section', {
    has: page.getByRole('heading', { name: /食べたもの/ }),
  });
}
