import { test, expect } from '@playwright/test';

test.describe('スモークテスト', () => {
  test('トップページが表示される', async ({ page }) => {
    await page.goto('/');
    // ページが読み込まれることを確認
    await expect(page).toHaveTitle(/推しトーク/);
  });

  test('ログインページに遷移できる', async ({ page }) => {
    await page.goto('/login');
    // URL が /login であることを確認
    await expect(page).toHaveURL(/\/login/);
    // ページが読み込まれるまで待機（エラーでなければOK）
    await page.waitForLoadState('networkidle');
  });
});
