# Stripe決済フロー設計書

## 概要

OshiTalkアプリケーションにおけるStripe決済の完全なフローと、PaymentIntentのステータス管理、Webhookイベントの処理順序を説明します。

## Stripe PaymentIntentのステータス遷移

### ステータス一覧

| ステータス | 説明 | 発生タイミング |
|-----------|------|---------------|
| `requires_payment_method` | 支払い方法が必要 | PaymentIntent作成時（未使用） |
| `requires_confirmation` | 確認が必要 | PaymentIntent作成時（未使用） |
| `requires_capture` | キャプチャ待ち（与信確保済み） | 入札時（`capture_method: 'manual'`） |
| `succeeded` | 決済成功（入金確定） | Capture実行後 |
| `canceled` | キャンセル済み | Cancel実行後 |

### ステータス遷移図

```
[入札時]
PaymentIntent作成
  ↓
requires_capture (与信確保済み)
  ↓
[Talk完了時]
Capture実行
  ↓
succeeded (決済確定)
  ↓
[Webhook受信]
payment_intent.succeeded
  ↓
Transfer実行
```

## 現在のアプリケーションでの制御フロー

### フェーズ1: 入札時（与信確保）

**エンドポイント**: `/api/stripe/authorize-payment`

**処理内容**:
1. 前回の最高入札者のPaymentIntentをキャンセル（別ユーザーの場合）
2. カード有効期限チェック
3. オークションからインフルエンサーIDを取得
4. インフルエンサー情報を取得（ConnectアカウントID、手数料率）
5. PaymentIntent作成
   - **Destination Charges方式**（オンボーディング完了済みの場合）:
     - `on_behalf_of`: インフルエンサーのConnectアカウントID
     - `application_fee_amount`: プラットフォーム手数料（手数料率 × 金額）
     - `transfer_data.destination`: インフルエンサーのConnectアカウントID
   - **Direct Charges方式**（オンボーディング未完了の場合）:
     - 従来の方式（フォールバック）
   - `capture_method: 'manual'`（手動キャプチャ）
   - `confirm: true`（即座に確認）
   - `off_session: true`（オフセッション決済）

**PaymentIntentステータス**: `requires_capture`

**コード実装**:
```typescript
// インフルエンサー情報を取得
const { data: auction } = await supabase
  .from('auctions')
  .select('call_slots!inner(user_id)')
  .eq('id', auctionId)
  .single();

const influencerUserId = auction?.call_slots?.user_id;

const { data: influencer } = await supabase
  .from('users')
  .select('stripe_connect_account_id, stripe_connect_account_status, platform_fee_rate')
  .eq('id', influencerUserId)
  .single();

// Destination Charges方式
if (influencer?.stripe_connect_account_id && 
    influencer.stripe_connect_account_status === 'active') {
  const platformFeeRate = influencer.platform_fee_rate ?? 0.2;
  const platformFee = Math.round(amount * platformFeeRate);
  
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount),
    currency: 'jpy',
    customer: customerId,
    payment_method: defaultPaymentMethodId,
    capture_method: 'manual',
    confirm: true,
    off_session: true,
    on_behalf_of: influencer.stripe_connect_account_id,
    application_fee_amount: platformFee,
    transfer_data: {
      destination: influencer.stripe_connect_account_id,
    },
    metadata: {
      auction_id: auctionId,
      user_id: userId,
      influencer_id: influencerUserId,
    },
  });
} else {
  // フォールバック: Direct Charges方式
  const paymentIntent = await stripe.paymentIntents.create({
    // 従来の実装
  });
}
```

**結果**:
- カードの利用可能額が一時的に「保留」される
- 実際の課金は発生しない（与信確保のみ）
- PaymentIntent IDを`bids`テーブルに保存

---

### フェーズ2: オークション終了時

**エンドポイント**: `/api/auctions/finalize-ended`

**処理内容**:
1. 最高入札者を決定
2. `purchased_slots`レコードを作成
3. 落札者のPaymentIntent IDを`purchased_slots`に保存
4. 非落札者のPaymentIntentをキャンセル

**PaymentIntentステータス**: `requires_capture`（維持）

**結果**:
- 落札者の与信は保持される
- 非落札者の与信は解放される
- 決済はまだ実行されない（Talk完了後に実行）

---

### フェーズ3: Talk完了時（決済確定）

**エンドポイント**: `/api/calls/end-call` → `processTalkPayment()` → `captureTalkPayment()`

**処理内容**:
1. Talk完了判定（`shouldCaptureTalkPayment()`）
   - インフルエンサー参加確認
   - 規定時間経過確認
   - 途中退出なし確認

2. 条件を満たす場合: Capture実行
   ```typescript
   // backend/src/services/paymentCapture.ts (line 426)
   capturedPayment = await stripe.paymentIntents.capture(paymentIntentId);
   ```

3. 条件を満たさない場合: Cancel実行
   ```typescript
   // backend/src/services/paymentCapture.ts (line 386)
   await stripe.paymentIntents.cancel(paymentIntentId);
   ```

**PaymentIntentステータス遷移**:
- `requires_capture` → `succeeded`（Capture成功時）
- `requires_capture` → `canceled`（Cancel実行時）

**Stripeの動作**:
- **Destination Charges方式の場合**:
  - Capture実行時、自動的に分割入金される
  - インフルエンサー: 総額 - 手数料
  - プラットフォーム: 手数料
  - Transfer処理は不要
- **Direct Charges方式の場合**:
  - Capture実行時、プラットフォームアカウントに即座に入金
  - Capture実行後、即座にTransfer処理を実行（Webhook不要）
- Capture実行時、Stripeは自動的に`payment_intent.succeeded`イベントを送信（ログ用）

**コード実装**:
```typescript
// backend/src/services/paymentCapture.ts (line 407-428)
const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

if (paymentIntent.status === 'succeeded') {
  // 既に決済済み
  isAlreadyCaptured = true;
} else if (paymentIntent.status !== 'requires_capture') {
  // キャプチャ不可能
  return { success: false, message: `キャプチャ不可能: ${paymentIntent.status}` };
} else {
  // Capture実行
  capturedPayment = await stripe.paymentIntents.capture(paymentIntentId);
}

// Destination Charges方式の場合、application_fee_amountから手数料を取得
const platformFee = capturedPayment.application_fee_amount 
  ? capturedPayment.application_fee_amount / 100 // セント単位から円単位に変換
  : Math.round(bidAmount * 0.2); // フォールバック（Direct Charges方式）

const influencerPayout = bidAmount - platformFee;

// payment_transactionsに記録
await supabase.from('payment_transactions').insert({
  purchased_slot_id: purchasedSlotId,
  stripe_payment_intent_id: capturedPayment.id,
  stripe_charge_id: chargeId,
  amount: bidAmount,
  platform_fee: platformFee,
  influencer_payout: influencerPayout,
  status: 'captured',
  // stripe_transfer_idは不要（Destination Charges方式の場合）
});
```

**結果**:
- **Destination Charges方式**: 自動的に分割入金される（Transfer処理不要、`stripe_transfer_id`は`'auto_split'`）
- **Direct Charges方式**: `payment_transactions`レコードを作成し、即座にTransfer処理を実行（`stripe_transfer_id`を記録）
- `purchased_slots.call_status`を`completed`に更新
- Stripeから`payment_intent.succeeded`イベントが送信される（ログ用、Transfer処理は既に完了）

---

### フェーズ4: Webhook受信（ログ確認のみ）

**エンドポイント**: `/api/stripe/webhook`

**イベントタイプ**: `payment_intent.succeeded`

**処理内容**:
- Transfer処理はCapture時に実行済みのため、Webhookでは状態確認のみ
- `payment_transactions`の`stripe_transfer_id`を確認してログ出力

**注意**: Transfer処理はCapture時に実行されるため、WebhookでのTransfer処理は不要

---

## Stripe Webhookイベント一覧

### 現在処理しているイベント

| イベント | タイミング | 処理内容 |
|---------|-----------|---------|
| `payment_intent.succeeded` | Capture実行後（自動送信） | Transfer実行 |
| `payment_intent.payment_failed` | 決済失敗時 | `payment_transactions.status`を`failed`に更新 |
| `account.updated` | Stripe Connectアカウント更新時 | アカウント状態を同期 |

### イベント送信タイミング

**`payment_intent.succeeded`**:
- **送信タイミング**: `stripe.paymentIntents.capture()`実行後、即座に送信
- **テストモード**: テストモードでも送信される（実際の入金は発生しないが、イベントは送信される）
- **本番環境**: Capture実行時に実際の入金が発生し、同時にイベントが送信される

**重要**: Capture実行とWebhook送信は**同期処理**です。Capture実行後、Stripeが自動的に`payment_intent.succeeded`イベントを送信します。

---

## データベース状態遷移

### `bids`テーブル

| タイミング | `stripe_payment_intent_id` | 状態 |
|-----------|---------------------------|------|
| 入札時 | `pi_xxxxx`（新規作成） | `requires_capture` |
| オークション終了（落札） | `pi_xxxxx`（保持） | `requires_capture` |
| オークション終了（非落札） | `pi_xxxxx`（キャンセル） | `canceled` |

### `purchased_slots`テーブル

| タイミング | `stripe_payment_intent_id` | `call_status` | 状態 |
|-----------|---------------------------|---------------|------|
| オークション終了 | `pi_xxxxx` | `pending` | 決済待ち |
| Talk完了（正常） | `pi_xxxxx` | `completed` | 決済確定 |
| Talk完了（不成立） | `pi_xxxxx` | `cancelled` | 与信解放 |

### `payment_transactions`テーブル

| タイミング | `stripe_payment_intent_id` | `status` | `stripe_transfer_id` | 状態 |
|-----------|---------------------------|----------|---------------------|------|
| Capture実行時（Destination Charges） | `pi_xxxxx` | `captured` | `null`（不要） | 自動分割済み |
| Capture実行時（Direct Charges） | `pi_xxxxx` | `captured` | `null` | 入金予定額 |
| Webhook受信時（Direct Charges） | `pi_xxxxx` | `captured` | `tr_xxxxx` | 総売上（受取額） |

### `users`テーブル

| カラム | 説明 | デフォルト値 |
|--------|------|------------|
| `platform_fee_rate` | プラットフォーム手数料率（0.0-1.0） | `0.2`（20%） |

---

## エラーハンドリング

### Capture失敗時

**原因**:
- PaymentIntentが既に`canceled`状態
- PaymentIntentが既に`succeeded`状態
- 残高不足（テストモードでは発生しない）

**処理**:
- エラーログを記録
- `purchased_slots.call_status`を`cancelled`に更新
- ユーザーにエラーを通知

### Transfer失敗時

**原因**:
- プラットフォームアカウントの残高不足
- Stripe Connectアカウントが未設定
- Transfer APIエラー

**処理**:
- エラーログを記録
- `payment_transactions.stripe_transfer_id`は`null`のまま
- 後でリトライ可能（Webhookを再送信）

---

## テスト環境での動作

### テストモード（Staging環境）

1. **Capture実行時**:
   - PaymentIntentステータスが`succeeded`に変わる
   - `payment_intent.succeeded`イベントが**自動的に送信される**
   - 実際の入金は発生しないが、イベントは送信される

2. **Webhook受信**:
   - Stripe DashboardでWebhookエンドポイントを設定する必要がある
   - テストモードでも、Capture実行時にWebhookが送信される

3. **Transfer実行**:
   - テストモードでもTransferは実行される
   - プラットフォームアカウントにテスト残高が必要

### 本番環境

1. **Capture実行時**:
   - 実際の入金が発生する
   - `payment_intent.succeeded`イベントが自動的に送信される

2. **Webhook受信**:
   - 本番環境のWebhookエンドポイントに送信される

3. **Transfer実行**:
   - 実際の送金が発生する

---

## 重要なポイント

### 1. Destination Charges方式 vs Direct Charges方式

**Destination Charges方式**（推奨）:
- オンボーディング完了済みのインフルエンサーに対して適用
- PaymentIntent作成時に`on_behalf_of`と`application_fee_amount`を指定
- Capture実行時に自動的に分割入金される
- Transfer処理が不要

**Direct Charges方式**（フォールバック）:
- オンボーディング未完了のインフルエンサーに対して適用
- 従来の方式（Capture実行後にTransfer処理）

### 2. 手数料率の設定

- **デフォルト**: 20%（0.2）
- **初期インフルエンサー**: 0%（0.0）に設定可能
- **インフルエンサーごとに設定可能**: `users.platform_fee_rate`（0.0-1.0）

### 3. CaptureとWebhookの関係

- **Capture実行** → **即座にWebhook送信**（同期処理）
- テストモードでも、Capture実行時に`payment_intent.succeeded`イベントは送信される
- Webhookが届かない場合は、Webhookエンドポイントの設定を確認

### 4. 入金処理のタイミング

- **Destination Charges方式**: Capture実行時に自動的に分割入金される
- **Direct Charges方式**: 入金処理（Charge）はCapture実行時に即座に処理される（非同期ではない）
- テストモードでは実際の入金は発生しないが、イベントは送信される

### 5. Transfer処理のタイミング

- **Destination Charges方式**: Transfer処理は不要（自動分割済み、`stripe_transfer_id`は`'auto_split'`）
- **Direct Charges方式**: Capture実行後、即座にTransfer処理を実行（Webhook不要）

### 6. ステータス管理

- **Destination Charges方式**: `application_fee_amount`が設定されている → 自動分割済み（`stripe_transfer_id`は`'auto_split'`）
- **Direct Charges方式**: Capture実行時にTransfer処理を実行し、`stripe_transfer_id`を記録 → 総売上（受取額）
- **エラー時**: Transfer処理が失敗した場合、`stripe_transfer_id`は`null`のまま（後でリトライ可能）

---

## 関連ファイル

| ファイル | 説明 |
|---------|------|
| `backend/src/server.ts` | PaymentIntent作成、Webhook処理 |
| `backend/src/services/paymentCapture.ts` | Capture処理、決済判定 |
| `backend/src/routes/dailyWebhook.ts` | Talk完了処理、Captureトリガー |
| `backend/src/routes/calls.ts` | 通話終了処理 |

---

## 参考リンク

- [Stripe PaymentIntent API](https://stripe.com/docs/api/payment_intents)
- [Stripe Webhook Events](https://stripe.com/docs/api/events/types)
- [Stripe Capture](https://stripe.com/docs/payments/capture-later)
- [Stripe Transfers](https://stripe.com/docs/connect/charges-transfers)

