# Destination Charges方式実装計画

## 概要

Stripe ConnectのDestination Charges方式を実装し、インフルエンサーごとに手数料率を設定できるようにします。

## 実装内容

### 1. データベーススキーマ変更

**マイグレーションファイル**: `supabase/migrations/[timestamp]_add_platform_fee_rate.sql`

```sql
-- usersテーブルにplatform_fee_rateカラムを追加
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS platform_fee_rate numeric DEFAULT 0.2;

-- コメント追加
COMMENT ON COLUMN users.platform_fee_rate IS 'プラットフォーム手数料率（0.0-1.0）。デフォルトは0.2（20%）。初期インフルエンサーは0.0（0%）に設定可能。';
```

**デフォルト値**:
- 新規インフルエンサー: `0.2`（20%）
- 初期インフルエンサー: `0.0`（0%）に手動で設定

---

### 2. PaymentIntent作成時の変更

**エンドポイント**: `/api/stripe/authorize-payment`

**変更内容**:
1. オークションからインフルエンサーIDを取得
2. インフルエンサーのConnectアカウントIDと手数料率を取得
3. Destination Charges方式でPaymentIntentを作成（オンボーディング完了の場合）
4. フォールバック: オンボーディング未完了の場合は従来の方式

**実装例**:
```typescript
// 1. オークションからインフルエンサーIDを取得
const { data: auction, error: auctionError } = await supabase
  .from('auctions')
  .select('call_slots!inner(user_id)')
  .eq('id', auctionId)
  .single();

const influencerUserId = auction?.call_slots?.user_id;

// 2. インフルエンサー情報を取得
const { data: influencer, error: influencerError } = await supabase
  .from('users')
  .select('stripe_connect_account_id, stripe_connect_account_status, platform_fee_rate')
  .eq('id', influencerUserId)
  .single();

// 3. Destination Charges方式でPaymentIntentを作成
if (influencer?.stripe_connect_account_id && 
    influencer.stripe_connect_account_status === 'active') {
  
  const platformFeeRate = influencer.platform_fee_rate ?? 0.2; // デフォルト20%
  const platformFee = Math.round(amount * platformFeeRate);
  
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount),
    currency: 'jpy',
    customer: customerId,
    payment_method: defaultPaymentMethodId,
    capture_method: 'manual',
    confirm: true,
    off_session: true,
    // Destination Charges用の設定
    on_behalf_of: influencer.stripe_connect_account_id,
    application_fee_amount: platformFee,
    transfer_data: {
      destination: influencer.stripe_connect_account_id,
    },
    metadata: {
      auction_id: auctionId,
      user_id: userId,
      influencer_id: influencerUserId,
      platform_fee_rate: platformFeeRate.toString(),
    },
  });
} else {
  // フォールバック: 従来の方式（オンボーディング未完了の場合）
  const paymentIntent = await stripe.paymentIntents.create({
    // 現在の実装
  });
}
```

---

### 3. Capture処理の変更

**ファイル**: `backend/src/services/paymentCapture.ts`

**変更内容**:
1. Destination Charges方式の場合、Transfer処理は不要
2. `application_fee_amount`から手数料を取得
3. `payment_transactions`に記録（`stripe_transfer_id`は不要）

**実装例**:
```typescript
// Capture実行
const capturedPayment = await stripe.paymentIntents.capture(paymentIntentId);

// Destination Charges方式の場合、application_fee_amountから手数料を取得
const platformFee = capturedPayment.application_fee_amount 
  ? capturedPayment.application_fee_amount / 100 // セント単位から円単位に変換
  : Math.round(bidAmount * 0.2); // フォールバック（従来の方式）

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

---

### 4. Webhook処理の変更

**ファイル**: `backend/src/server.ts`

**変更内容**:
1. Destination Charges方式の場合、Transfer処理は不要
2. `payment_intent.succeeded`イベントは記録のみ

**実装例**:
```typescript
case 'payment_intent.succeeded':
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  
  // Destination Charges方式の場合、Transfer処理は不要
  // application_fee_amountが設定されている場合は自動分割済み
  if (paymentIntent.application_fee_amount) {
    console.log('✅ 決済成功（Destination Charges方式、自動分割入金済み）');
    // payment_transactionsの記録はCapture処理で既に完了
  } else {
    // フォールバック: 従来の方式（Transfer処理が必要）
    // 既存のTransfer処理を実行
  }
  break;
```

---

### 5. 売上表示ロジックの変更

**ファイル**: `backend/src/server.ts` (`/api/stripe/influencer-earnings`)

**変更内容**:
1. Destination Charges方式の場合、`stripe_transfer_id`は不要
2. `application_fee_amount`から手数料を取得

**実装例**:
```typescript
// payment_transactionsから集計
const { data: transactions } = await supabase
  .from('payment_transactions')
  .select('*')
  .eq('purchased_slots.influencer_user_id', user.id)
  .eq('status', 'captured');

// Destination Charges方式の場合、stripe_transfer_idは不要
// application_fee_amountが設定されている場合は自動分割済み
const totalEarnings = transactions
  .filter(tx => {
    // Destination Charges方式: application_fee_amountが設定されている
    // 従来の方式: stripe_transfer_idが設定されている
    return tx.stripe_transfer_id !== null || 
           (tx.stripe_payment_intent_id && /* PaymentIntentからapplication_fee_amountを確認 */);
  })
  .reduce((sum, tx) => sum + tx.influencer_payout, 0);
```

---

## 実装手順

### ステップ1: データベースマイグレーション

1. マイグレーションファイルを作成
2. `platform_fee_rate`カラムを追加
3. 初期インフルエンサーの手数料率を0%に設定（必要に応じて）

### ステップ2: PaymentIntent作成時の変更

1. オークションからインフルエンサーIDを取得
2. インフルエンサー情報を取得（ConnectアカウントID、手数料率）
3. Destination Charges方式でPaymentIntentを作成
4. フォールバック処理を実装

### ステップ3: Capture処理の変更

1. `application_fee_amount`から手数料を取得
2. Transfer処理を削除
3. `payment_transactions`に記録

### ステップ4: Webhook処理の変更

1. Destination Charges方式の判定を追加
2. Transfer処理を削除（Destination Charges方式の場合）

### ステップ5: 売上表示ロジックの変更

1. `stripe_transfer_id`の判定を変更
2. Destination Charges方式に対応

### ステップ6: 業務仕様・機能仕様の更新

1. 業務仕様ドキュメントを更新
2. 機能仕様ドキュメントを更新

---

## 手数料率の管理

### デフォルト値

- 新規インフルエンサー: `0.2`（20%）
- 初期インフルエンサー: `0.0`（0%）に手動で設定

### 手数料率の設定方法

**方法1: データベースで直接設定**
```sql
-- 特定のインフルエンサーの手数料率を0%に設定
UPDATE users
SET platform_fee_rate = 0.0
WHERE id = 'influencer-user-id';
```

**方法2: 管理画面で設定（将来実装）**
- インフルエンサーごとに手数料率を設定できる管理画面
- 手数料率の変更履歴を記録

### 手数料率の範囲

- 最小値: `0.0`（0%）
- 最大値: `1.0`（100%）
- デフォルト: `0.2`（20%）

---

## フォールバック戦略

### オンボーディング未完了の場合

- 従来のDirect Charges方式を使用
- Capture実行後にTransfer処理を実行
- Webhook処理でTransferを実行

### オンボーディング完了後

- Destination Charges方式に自動的に移行
- 既存のPaymentIntentは従来の方式のまま
- 新しいPaymentIntentからDestination Charges方式を使用

---

## テスト計画

### テストケース1: Destination Charges方式（手数料20%）

1. オンボーディング完了済みのインフルエンサーで入札
2. Talk完了 → Capture実行
3. 自動的に分割入金されることを確認
4. マイページで売上が正しく表示されることを確認

### テストケース2: Destination Charges方式（手数料0%）

1. 手数料率0%のインフルエンサーで入札
2. Talk完了 → Capture実行
3. インフルエンサーに全額入金されることを確認
4. プラットフォーム手数料が0円であることを確認

### テストケース3: フォールバック（オンボーディング未完了）

1. オンボーディング未完了のインフルエンサーで入札
2. 従来の方式でPaymentIntentが作成されることを確認
3. Talk完了 → Capture実行
4. WebhookでTransfer処理が実行されることを確認

---

## 注意事項

### Destination Charges方式の制約

1. **オンボーディング要件**: インフルエンサーのConnectアカウントがオンボーディング完了している必要がある
2. **国・地域の制約**: 一部の国・地域では利用できない可能性がある
3. **手数料の計算**: `application_fee_amount`は整数（セント単位）で指定する必要がある

### 移行時の注意点

1. 既存のPaymentIntentは従来の方式のまま
2. 新しいPaymentIntentからDestination Charges方式を使用
3. オンボーディング未完了の場合は自動的にフォールバック

---

## 関連ファイル

| ファイル | 変更内容 |
|---------|---------|
| `supabase/migrations/[timestamp]_add_platform_fee_rate.sql` | マイグレーション（新規作成） |
| `backend/src/server.ts` | PaymentIntent作成、Webhook処理、売上表示 |
| `backend/src/services/paymentCapture.ts` | Capture処理 |
| `docs/business/payment.md` | 業務仕様更新 |
| `docs/functional/STRIPE_PAYMENT_FLOW.md` | 機能仕様更新 |

