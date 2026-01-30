import { test, expect } from '@playwright/test';

test.describe('Dashboard VRT', () => {
  test('should match the dashboard snapshot', async ({ page }) => {
    // ページに移動
    await page.goto('/');
    
    // 内容がロードされるまで待機（必要に応じて調整）
    await page.waitForLoadState('networkidle');
    
    // アニメーションを停止させるための設定（Framer Motionなどを使用している場合）
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0s !important;
        }
      `,
    });

    // スクリーンショットの比較
    await expect(page).toHaveScreenshot('dashboard.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05, // わずかな差異（レンダリングのゆらぎ）を許容
    });
  });
});
