import { test, expect } from '@playwright/test';

const pages = [
  { name: 'dashboard', path: '/' },
  { name: 'add-food', path: '/add' },
  { name: 'calendar', path: '/calendar' },
  { name: 'log', path: '/log' },
  { name: 'manage-foods', path: '/manage-foods' },
  { name: 'settings', path: '/settings' },
  { name: 'signup', path: '/signup' },
];

test.describe('Pages VRT', () => {
  for (const pageInfo of pages) {
    test(`should match snapshot for ${pageInfo.name}`, async ({ page }) => {
      // ページに移動
      await page.goto(pageInfo.path);
      
      // 内容がロードされるまで待機
      await page.waitForLoadState('networkidle');
      
      // アニメーションを停止させるための設定
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-duration: 0s !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0s !important;
          }
        `,
      });

      // 特定の要素（ BMI ゲージなど）がレンダリングされるのを待つ
      if (pageInfo.name === 'dashboard') {
        await page.waitForSelector('.recharts-surface', { timeout: 5000 }).catch(() => {});
      }

      // スクリーンショットの比較
      await expect(page).toHaveScreenshot(`${pageInfo.name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.05,
      });
    });
  }
});
