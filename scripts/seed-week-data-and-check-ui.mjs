#!/usr/bin/env node
import { chromium } from '@playwright/test';

const DEFAULT_BASE_URL = 'http://127.0.0.1:3000';
const STORAGE_KEY_LOGS = 'pfc_logs';
const DAYS = 7;
const CALORIE_BASE = 350;

const baseUrl = process.argv[2] || process.env.BASE_URL || DEFAULT_BASE_URL;

/**
 * Date を YYYY-MM-DD 形式の文字列に変換する。
 * @param {Date} date
 */
function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * グラフのX軸で使われる M/d 形式のラベルを作る。
 * @param {Date} date
 */
function toChartLabel(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * 指定日のテスト用食事データを作成する。
 * @param {Date} date
 * @param {number} index
 */
function createDailyEntry(date, index) {
  const timestamp = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    12,
    0,
    0,
    0,
  ).getTime();

  const item = {
    id: `seed-item-${index + 1}`,
    name: `テスト食事 ${index + 1}`,
    protein: 20 + index,
    fat: 10 + index,
    carbs: 50 + index,
    calories: CALORIE_BASE + index * 10,
    timestamp,
    store: '検証ストア',
  };

  return {
    date: toDateKey(date),
    items: [item],
    total: {
      protein: item.protein,
      fat: item.fat,
      carbs: item.carbs,
      calories: item.calories,
    },
  };
}

/**
 * 今日を含む過去1週間分のログを作成する。
 */
function createPastWeekLogs() {
  const logs = {};
  const today = new Date();

  for (let i = 0; i < DAYS; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const entry = createDailyEntry(date, i);
    logs[entry.date] = entry;
  }

  return logs;
}

/**
 * localStorage にログを投入したブラウザコンテキストを作る。
 * @param {import('@playwright/test').Browser} browser
 * @param {Record<string, unknown>} logs
 */
async function createSeededContext(browser, logs) {
  const context = await browser.newContext();
  await context.addInitScript(
    ({ storageKey, payload }) => {
      localStorage.setItem(storageKey, JSON.stringify(payload));
    },
    { storageKey: STORAGE_KEY_LOGS, payload: logs },
  );
  return context;
}

/**
 * 履歴画面の表示を確認する。
 * @param {import('@playwright/test').Page} page
 */
async function checkLogPage(page) {
  await page.goto(`${baseUrl}/log`, { waitUntil: 'networkidle' });

  for (let i = 1; i <= DAYS; i++) {
    await page.getByText(`テスト食事 ${i}`).first().waitFor({ timeout: 5000 });
  }

  const screenshotPath = 'artifacts/seed-week-log-ui-check.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return screenshotPath;
}

/**
 * ホーム画面の過去日グラフ表示を確認する。
 * @param {import('@playwright/test').Page} page
 */
async function checkHomePastDateGraph(page) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  await page.getByRole('heading', { name: '今日のバランス' }).waitFor({ timeout: 5000 });
  await page.getByText(String(CALORIE_BASE)).first().waitFor({ timeout: 5000 });

  await page.getByRole('button', { name: 'Previous day' }).click();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayTitle = `${yesterday.getMonth() + 1}月${yesterday.getDate()}日のバランス`;
  const yesterdayCalories = String(CALORIE_BASE + 10);

  await page.getByRole('heading', { name: yesterdayTitle }).waitFor({ timeout: 5000 });
  await page.getByText(yesterdayCalories).first().waitFor({ timeout: 5000 });

  const oldest = new Date();
  oldest.setDate(oldest.getDate() - (DAYS - 1));
  const oldestLabel = toChartLabel(oldest);
  await page.getByText(oldestLabel).first().waitFor({ timeout: 5000 });

  const screenshotPath = 'artifacts/seed-week-home-graph-check.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return screenshotPath;
}

async function run() {
  const logs = createPastWeekLogs();
  const browser = await chromium.launch({ headless: true });
  const context = await createSeededContext(browser, logs);
  const page = await context.newPage();

  const logScreenshot = await checkLogPage(page);
  const homeScreenshot = await checkHomePastDateGraph(page);

  await browser.close();

  console.log(`過去1週間分のテストデータを登録しました: ${Object.keys(logs).length}日分`);
  console.log(`UIチェック完了: /log と / の過去日表示を確認`);
  console.log(`スクリーンショット(log): ${logScreenshot}`);
  console.log(`スクリーンショット(home): ${homeScreenshot}`);
}

run().catch((error) => {
  console.error('スクリプト実行中にエラーが発生しました。');
  console.error(error);
  process.exit(1);
});
