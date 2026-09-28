import { expect, test } from '@playwright/test';

test('未ログインではログインを促す', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'ログインが必要です' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'ログイン画面へ' }).click();
  await expect(
    page.getByRole('button', { name: 'Google でログイン' }),
  ).toBeVisible();
});
