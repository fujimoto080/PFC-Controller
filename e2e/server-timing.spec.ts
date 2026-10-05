import { expect, test } from './fixtures';

test('API が DB クエリごとの所要時間を Server-Timing で返す', async ({
  page,
}) => {
  const response = await page.request.get('/api/user-data');
  expect(response.ok()).toBe(true);
  expect(response.headers()['server-timing']).toMatch(
    /^total;dur=[\d.]+, db;dur=[\d.]+;desc="\d+ queries", q1;dur=[\d.]+;desc=".+"/,
  );
});
