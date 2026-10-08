import { dayLogList, expect, test } from './fixtures';

test('JSONカタログの商品を共通フォームで開き、食品リストと食事記録に保存できる', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'まだ記録がありません' }).click();
  await page.getByRole('textbox', { name: '食品を検索' }).fill('牛めし');
  await expect(page.getByText('店舗・メーカーのカタログ')).toBeVisible();
  await page
    .locator('ul')
    .getByRole('button', { name: /牛めし/ })
    .first()
    .click();
  const name = await page.getByLabel('食品名', { exact: true }).inputValue();
  await expect(page.getByRole('button', { name: 'AI で推定' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: '保存済みの画像を追加' }),
  ).toBeVisible();
  await expect(page.getByLabel('バーコード (任意・複数可)')).toBeVisible();
  await expect(
    page.getByRole('checkbox', { name: '食品リストに登録する' }),
  ).toBeChecked();
  await expect(
    page.getByRole('checkbox', { name: '食べた記録にも追加する' }),
  ).toBeChecked();
  await page.getByLabel('店内グループ (任意)').fill('カタログから登録');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(
    dayLogList(page).getByRole('button', {
      name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    }),
  ).toBeVisible();
  await page.goto('/foods');
  await expect(
    page.getByText('カタログから登録', { exact: true }),
  ).toBeVisible();
});

test('食品管理からも日時と数量を指定して記録でき、食品の栄養値は1個分のまま保存する', async ({
  page,
}) => {
  await page.goto('/foods');
  await page.getByRole('button', { name: '新規' }).click();
  await page.getByLabel('食品名', { exact: true }).fill('数量指定のチキン');
  await page.getByLabel('タンパク質').fill('25');
  await page.getByLabel('脂質').fill('5');
  await page.getByLabel('炭水化物').fill('10');
  await page.getByLabel('カロリー').fill('185');
  await page.getByLabel('数量を指定').fill('3');
  await page.getByRole('checkbox', { name: '食べた記録にも追加する' }).check();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(
    page.getByText('数量指定のチキン', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText('数量指定のチキン', { exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: '今日', exact: true }).click();
  await expect(
    dayLogList(page).getByRole('button', { name: /数量指定のチキン/ }),
  ).toContainText('555');
});
