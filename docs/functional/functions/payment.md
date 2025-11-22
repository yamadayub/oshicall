# 決済・カード登録機能 要件定義

## 概要
Stripe APIを使用した安全な決済処理。与信確保（Authorization）と決済確定（Capture）の2段階決済を実装。

## 決済フロー概要

```
入札時: Authorization（与信確保）
  ↓
オークション終了
  ↓
落札者: Capture（決済確定）
落札できなかった人: Cancel（与信解放）
```

## 機能詳細

### 1. Stripe顧客作成
**実装ファイル**: `backend/src/routes/stripe.ts` (`POST /api/stripe/create-customer`)

**タイミング**: 初回カード登録時

**処理フロー**:
1. Supabaseからユーザー情報取得
2. Stripe顧客作成
3. `users`テーブルに`stripe_customer_id`保存

**リクエスト**:
```json
{
  "userId": "user_uuid",
  "email": "user@example.com",
  "name": "User Name"
}
```

**レスポンス**:
```json
{
  "customerId": "cus_xxxxx"
}
```

**Stripe API**:
```typescript
const customer = await stripe.customers.create({
  email: email,
  name: name,
  metadata: { supabase_user_id: userId }
});
```

### 2. カード情報登録
**実装ファイル**:
- フロント: `src/components/CardRegistrationModal.tsx`
- バックエンド: `backend/src/routes/stripe.ts`

**使用技術**: Stripe Elements (Stripe公式UIコンポーネント)

**処理フロー**:
1. Stripe Elements でカード情報入力
2. `PaymentMethod` 作成（フロント）
3. バックエンドに `paymentMethodId` 送信
4. Stripe顧客にカード紐付け
5. デフォルト支払い方法として設定
6. Supabaseの`has_payment_method`を`true`に更新

**API エンドポイント**: `POST /api/stripe/attach-payment-method`

**リクエスト**:
```json
{
  "customerId": "cus_xxxxx",
  "paymentMethodId": "pm_xxxxx",
  "userId": "user_uuid"
}
```

**レスポンス**:
```json
{
  "success": true
}
```

**Stripe API**:
```typescript
// PaymentMethodを顧客に紐付け
await stripe.paymentMethods.attach(paymentMethodId, {
  customer: customerId
});

// デフォルト支払い方法として設定
await stripe.customers.update(customerId, {
  invoice_settings: {
    default_payment_method: paymentMethodId
  }
});
```

### 3. 与信確保（Authorization）
**実装ファイル**: `backend/src/routes/stripe.ts` (`POST /api/stripe/authorize-payment`)

**タイミング**: 入札時または即決購入時

**処理フロー**:
1. PaymentIntent作成
2. `capture_method: 'manual'` 指定（自動決済を防ぐ）
3. 顧客のデフォルト支払い方法使用
4. `paymentIntentId`を返却
5. `bids`テーブルに保存

**リクエスト**:
```json
{
  "amount": 5000,
  "customerId": "cus_xxxxx",
  "auctionId": "auction_uuid",
  "userId": "user_uuid"
}
```

**レスポンス**:
```json
{
  "paymentIntentId": "pi_xxxxx"
}
```

**Stripe API**:
```typescript
const paymentIntent = await stripe.paymentIntents.create({
  amount: amount,
  currency: 'jpy',
  customer: customerId,
  capture_method: 'manual', // 重要: 自動決済しない
  payment_method_types: ['card'],
  metadata: {
    auction_id: auctionId,
    user_id: userId
  }
});
```

**与信確保の意味**:
- カードの有効性確認
- 利用可能額の確認
- 金額を一時的に「保留」（実際の引き落としはまだ）
- 最大7日間保持可能

### 4. 決済確定（Capture）
**実装ファイル**:
- `backend/src/routes/stripe.ts` (`POST /api/stripe/capture-payment`)
- `supabase/functions/end-auction/index.ts`

**タイミング**:
- オークション終了時（落札者のみ）
- 即決購入時（即座に）

**処理フロー**:
1. `paymentIntentId`を取得
2. Stripe Capture API呼び出し
3. 決済完了
4. `purchased_slots`の`stripe_payment_intent_id`更新

**API エンドポイント**: `POST /api/stripe/capture-payment`

**リクエスト**:
```json
{
  "paymentIntentId": "pi_xxxxx"
}
```

**レスポンス**:
```json
{
  "success": true,
  "amount": 5000
}
```

**Stripe API**:
```typescript
const paymentIntent = await stripe.paymentIntents.capture(
  paymentIntentId
);
```

### 5. 与信解放（Cancel）
**実装ファイル**:
- `backend/src/routes/stripe.ts` (`POST /api/stripe/cancel-payment`)
- `supabase/functions/end-auction/index.ts`

**タイミング**: オークション終了時（落札できなかった入札者）

**処理フロー**:
1. 落札できなかった入札の`paymentIntentId`を取得
2. Stripe Cancel API呼び出し
3. 与信解放（保留金額解除）

**API エンドポイント**: `POST /api/stripe/cancel-payment`

**リクエスト**:
```json
{
  "paymentIntentId": "pi_xxxxx"
}
```

**レスポンス**:
```json
{
  "success": true
}
```

**Stripe API**:
```typescript
const paymentIntent = await stripe.paymentIntents.cancel(
  paymentIntentId
);
```

### 6. オークション終了時の決済処理
**実装ファイル**: `supabase/functions/end-auction/index.ts`

**トリガー**: Supabase Cron Job（1分ごと）

**処理フロー**:
```typescript
// 1. 終了したオークションを取得
const endedAuctions = await supabase
  .from('auctions')
  .select('*')
  .eq('status', 'active')
  .lt('end_time', new Date().toISOString());

for (const auction of endedAuctions) {
  // 2. 最高入札を取得
  const winningBid = await getWinningBid(auction.id);

  if (winningBid) {
    // 3. 落札者の決済確定
    await capturePayment(winningBid.stripe_payment_intent_id);

    // 4. purchased_slot作成
    await createPurchasedSlot(auction, winningBid);

    // 5. 他の入札者の与信解放
    const losingBids = await getLosingBids(auction.id, winningBid.id);
    for (const bid of losingBids) {
      await cancelPayment(bid.stripe_payment_intent_id);
    }
  }

  // 6. オークション終了
  await supabase
    .from('auctions')
    .update({ status: 'ended', current_winner_id: winningBid.user_id })
    .eq('id', auction.id);
}
```

## データ構造

### users テーブル（決済関連フィールド）
```sql
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN has_payment_method BOOLEAN DEFAULT FALSE;
```

### bids テーブル（決済関連フィールド）
```sql
CREATE TABLE bids (
  ...
  stripe_payment_intent_id TEXT NOT NULL,
  ...
);
```

### purchased_slots テーブル（決済関連フィールド）
```sql
CREATE TABLE purchased_slots (
  ...
  stripe_payment_intent_id TEXT,
  final_price INTEGER NOT NULL,
  purchase_type TEXT NOT NULL, -- 'auction' or 'buy_now'
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  ...
);
```

## UI/UX

### カード登録モーダル
**コンポーネント**: `src/components/CardRegistrationModal.tsx`

**表示内容**:
- Stripe Elements (カード番号、有効期限、CVC入力)
- 登録ボタン
- キャンセルボタン
- セキュリティ説明（「カード情報は安全に保護されます」）

**表示タイミング**:
- 未登録ユーザーが入札しようとした時
- マイページから手動登録

### 支払いタイミングの説明
各入札画面に表示:
```
💡 お支払いのタイミング
入札時点では料金は発生しません。
オークション終了後、最高入札者として落札した場合のみ、
登録済みのカードから自動決済されます。
```

### カード情報表示
- マイページに登録済みカード表示
- 末尾4桁のみ表示（例: •••• 4242）
- カードブランド表示（Visa, Mastercard等）

## エラーハンドリング

### カード登録エラー
- カード番号不正: `カード番号が正しくありません`
- 有効期限切れ: `カードの有効期限が切れています`
- CVC不正: `セキュリティコードが正しくありません`
- ネットワークエラー: `通信エラーが発生しました。再度お試しください`

### 与信確保エラー
- 利用限度額超過: `カードの利用限度額を超えています`
- カード無効: `カードが無効です。別のカードをお試しください`
- 3Dセキュア必要: 認証画面表示

### 決済確定エラー
- タイムアウト: 自動リトライ（最大3回）
- PaymentIntent不正: エラーログ記録、管理者通知

## セキュリティ

### PCI DSS準拠
- カード情報を自社サーバーに保存しない
- Stripe Elements使用（カード情報はStripe経由で送信）
- トークン化されたpaymentMethodIdのみ扱う

### HTTPS通信
- 全ての決済関連通信はHTTPSのみ
- 本番環境でHTTP通信を禁止

### APIキー管理
- Stripe Secret Keyは環境変数で管理
- バージョン管理システムにコミットしない
- Heroku Config Varsで設定

### エラーログ
- 決済エラーは全てログ記録
- 個人情報（カード番号等）はログに含めない
- Stripe Dashboard で決済履歴確認可能

## テスト

### テストカード番号
**成功**:
- `4242 4242 4242 4242` - Visa

**失敗パターン**:
- `4000 0000 0000 0002` - カード拒否
- `4000 0000 0000 9995` - 残高不足

**有効期限**: 未来の日付（例: 12/34）
**CVC**: 任意の3桁（例: 123）

### テスト環境
- Stripeテストモード使用
- 本番のカード情報は使用しない
- Test APIキーで実行

## パフォーマンス

### 非同期処理
- 与信解放は非同期で実行
- オークション終了処理はバックグラウンドジョブ

### リトライロジック
- 決済確定失敗時は自動リトライ（指数バックオフ）
- 最大3回まで

### タイムアウト
- Stripe API呼び出しタイムアウト: 30秒
- 超過時はエラーハンドリング

## 監視・運用

### ログ
- 全ての決済処理をログ記録
- エラー発生時は詳細ログ
- Stripe Webhook イベントログ

### アラート
- 決済失敗率が閾値超過時に通知
- 与信解放失敗時に通知

### Stripe Dashboard
- 決済履歴確認
- 返金処理
- 顧客管理
