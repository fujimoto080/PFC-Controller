import { test as base, type Page } from '@playwright/test';
import { E2E_BASE_URL } from './env';
import { createSession, SESSION_COOKIE } from './session';

/** テストごとに新しいユーザーを作り、そのユーザーでログイン済みのセッション Cookie を付ける。 */
export const test = base.extend<{ userId: string }>({
  userId: [
    async ({ context }, provide) => {
      const session = await createSession();
      try {
        await context.addCookies([
          { name: SESSION_COOKIE, value: session.token, url: E2E_BASE_URL },
        ]);
        await provide(session.userId);
      } finally {
        await session.cleanup();
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
