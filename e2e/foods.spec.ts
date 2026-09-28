import { dayLogList, expect, test } from './fixtures';

test('食品リストに登録したお気に入りをホームからワンタップで記録できる', async ({
  page,
}) => {
  await page.goto('/foods');
  await page.getByRole('button', { name: '新規' }).click();
  await page.getByLabel('食品名', { exact: true }).fill('プロテインバー');
  await page.getByLabel('タンパク質 (g)').fill('15');
  await page.getByLabel('脂質 (g)').fill('7');
  await page.getByLabel('炭水化物 (g)').fill('12');
  await page.getByLabel('カロリー (kcal)').fill('180');
  await page.getByLabel('店名 / ブランド (任意)').fill('コンビニ');
  const foodSaved = page.waitForResponse(
    (res) => res.url().includes('/api/foods') && res.ok(),
  );
  await page.getByRole('button', { name: '保存' }).click();
  await foodSaved;

  const favoriteSaved = page.waitForResponse(
    (res) => res.url().includes('/api/settings') && res.ok(),
  );
  await page.getByRole('button', { name: 'お気に入り' }).click();
  await favoriteSaved;

  await page.getByRole('link', { name: '今日' }).click();
  await page.getByRole('button', { name: /プロテインバー\s*180kcal/ }).click();
  await expect(
    dayLogList(page).getByRole('button', { name: /プロテインバー/ }),
  ).toContainText('180');

  // お気に入りと記録がサーバーに保存されていることをリロード後の表示で確かめる
  await page.reload();
  await expect(
    page.getByRole('button', { name: /プロテインバー\s*180kcal/ }),
  ).toBeVisible();
  await expect(
    dayLogList(page).getByRole('button', { name: /プロテインバー/ }),
  ).toBeVisible();
});
