import { test as base, type Page } from '@playwright/test';
import { E2E_BASE_URL } from './env';
import { createSession, SESSION_COOKIE } from './session';

/** テストごとに独立したログイン状態を作り、ブラウザと HTTP クライアントで使えるようにする。 */
export const test = base.extend({
  storageState: async ({ baseURL }, provide) => {
    const session = await createSession();
    try {
      await provide({
        cookies: [
          {
            name: SESSION_COOKIE,
            value: session.token,
            domain: new URL(baseURL ?? E2E_BASE_URL).hostname,
            path: '/',
            expires: -1,
            httpOnly: true,
            secure: false,
            sameSite: 'Lax',
          },
        ],
        origins: [],
      });
    } finally {
      await session.cleanup();
    }
  },
});

export { expect } from '@playwright/test';

/** ホームの「食べたもの」一覧。 */
export function dayLogList(page: Page) {
  return page.locator('section', {
    has: page.getByRole('heading', { name: /食べたもの/ }),
  });
}
