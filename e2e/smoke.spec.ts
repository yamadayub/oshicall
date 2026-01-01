import { test, expect } from '@playwright/test';

test.describe('スモークテスト', () => {
  test('トップページが表示される', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/推しトーク/);
  });

  test('ログインページに遷移できる', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=ログイン')).toBeVisible();
  });
});
