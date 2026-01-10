import { Page } from '@playwright/test';

/**
 * Talk枠作成画面にアクセスする
 */
export async function navigateToCreateCallSlot(page: Page) {
  // マイページにアクセス（既に/mypageにいる場合は遷移しない）
  const currentURL = page.url();
  if (!currentURL.includes('/mypage')) {
    await page.goto('/mypage');
  }
  
  // ローディングが完了するまで待機
  await page.waitForLoadState('networkidle');
  
  // 「Talk枠」セクションが表示されるまで待機（インフルエンサー権限の確認）
  await page.waitForSelector('h3:has-text("Talk枠")', { timeout: 10000 });
  
  // 「新規作成」ボタンをクリック
  // ボタンが表示されるまで待機
  const createButton = page.locator('button:has-text("新規作成")').first();
  await createButton.waitFor({ state: 'visible', timeout: 10000 });
  await createButton.click();
  
  // モーダルまたはフォームが表示されるまで待機
  await page.waitForSelector('input[name="title"]', { timeout: 5000 });
}

/**
 * Talk枠を作成する
 */
export async function createCallSlot(page: Page, options: {
  title: string;
  description?: string;
  scheduledStartTime: string;
  durationMinutes: number;
  startingPrice: number;
  minimumBidIncrement?: number;
  buyNowPrice?: number;
  auctionEndTime: string;
}) {
  // Talk枠作成画面に移動
  await navigateToCreateCallSlot(page);
  
  // フォームに入力
  await page.fill('input[name="title"]', options.title);
  
  if (options.description) {
    await page.fill('textarea[name="description"]', options.description);
  }
  
  await page.fill('input[name="scheduled_start_time"]', options.scheduledStartTime);
  await page.selectOption('select[name="duration_minutes"]', options.durationMinutes.toString());
  
  // オークション終了時間を入力
  await page.fill('input[type="datetime-local"]:nth-of-type(2)', options.auctionEndTime);
  
  await page.fill('input[name="starting_price"]', options.startingPrice.toString());
  
  if (options.minimumBidIncrement) {
    await page.fill('input[name="minimum_bid_increment"]', options.minimumBidIncrement.toString());
  }
  
  if (options.buyNowPrice) {
    // 即決価格を有効にする
    await page.check('input[type="checkbox"]#hasBuyNowPrice');
    await page.fill('input[name="buy_now_price"]', options.buyNowPrice.toString());
  }
  
  // フォームを送信
  await page.click('button[type="submit"]:has-text("作成"), button[type="submit"]:has-text("保存")');
  
  // 作成完了を待つ（モーダルが閉じるか、リダイレクトされるまで）
  await page.waitForTimeout(2000);
  
  // 作成完了の確認（成功メッセージまたはリダイレクト）
  // await expect(page).toHaveURL(/\/talk\/[^/]+|\/mypage/);
}

/**
 * オークションページに入札する
 */
export async function placeBid(page: Page, bidAmount: number) {
  // カスタム入札フィールドを開く（鉛筆アイコンをクリック）
  await page.click('button[title*="入札"], button:has-text("カスタム")');
  
  // カスタム入札フィールドに入力
  await page.waitForSelector('input[placeholder*="入札金額"], input[type="number"]', { timeout: 5000 });
  await page.fill('input[placeholder*="入札金額"], input[type="number"]', bidAmount.toString());
  
  // 入札ボタンをクリック
  await page.click('button:has-text("入札する"), button:has-text("入札")');
  
  // 入札完了を待つ（アラートや成功メッセージが表示されるまで）
  await page.waitForTimeout(2000);
  
  // アラートを閉じる
  page.once('dialog', dialog => dialog.accept());
}

/**
 * 即決購入を実行する
 */
export async function buyNow(page: Page) {
  // 即決購入ボタンをクリック
  await page.click('button:has-text("即決で落札"), button:has-text("即決購入")');
  
  // 確認ダイアログでOK
  page.once('dialog', dialog => dialog.accept());
  
  // 購入完了を待つ（ページがリロードされるか、成功メッセージが表示されるまで）
  await page.waitForTimeout(3000);
  
  // アラートを閉じる
  page.once('dialog', dialog => dialog.accept());
}
