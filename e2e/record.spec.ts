import { dayLogList, expect, test } from './fixtures';

test.beforeEach(({ page }) => {
  page.on('dialog', (dialog) => void dialog.accept());
});

test('食事を手入力で記録し、編集・削除できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'まだ記録がありません' }).click();

  await page.getByRole('button', { name: '新しく入力する' }).click();
  await page.getByLabel('食品名', { exact: true }).fill('鶏むね肉のサラダ');
  await page.getByLabel('タンパク質').fill('25');
  await page.getByLabel('脂質').fill('5');
  await page.getByLabel('炭水化物').fill('10');
  await page.getByLabel('カロリー').fill('185');
  await page.getByRole('button', { name: '記録する' }).click();

  const logItem = dayLogList(page).getByRole('button', {
    name: /鶏むね肉のサラダ/,
  });
  await expect(logItem).toContainText('185');

  // サーバーに保存されていることをリロード後の表示で確かめる
  await page.reload();
  await expect(logItem).toBeVisible();

  await logItem.click();
  await page.getByLabel('カロリー').fill('200');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('更新しました')).toBeVisible();
  await expect(logItem).toContainText('200');

  await logItem.click();
  await page.getByRole('button', { name: '削除' }).click();
  await expect(page.getByText('削除しました')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'まだ記録がありません' }),
  ).toBeVisible();
});
