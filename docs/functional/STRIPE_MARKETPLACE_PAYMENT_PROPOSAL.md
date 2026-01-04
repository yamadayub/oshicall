# Stripeマーケットプレイス型決済実装提案

## 概要

現在の実装（Direct Charges + Transfer）から、マーケットプレイス型の決済方式に変更する提案です。

## 現在の実装（Direct Charges方式）

### フロー

```
1. 入札時: PaymentIntent作成（プラットフォームアカウント）
   ↓
2. Talk完了時: Capture実行
   ↓
3. プラットフォームアカウントに即座に入金
   ↓
4. Webhook受信: payment_intent.succeeded
   ↓
5. Transfer実行（手数料を差し引いてインフルエンサーに送金）
```

### 問題点

- プラットフォームがリスクを負う（入金後に送金）
- Webhookを待つ必要がある（非同期処理）
- 手数料計算を手動で行う必要がある

---

## 提案1: Destination Charges方式（推奨）

### 概要

PaymentIntent作成時に`on_behalf_of`と`application_fee_amount`を指定し、Connectアカウントに直接Chargeする方式です。

### フロー

```
1. 入札時: PaymentIntent作成
   - on_behalf_of: インフルエンサーのConnectアカウントID
   - application_fee_amount: プラットフォーム手数料
   ↓
2. Talk完了時: Capture実行
   ↓
3. 自動的に分割入金:
   - インフルエンサー: 総額 - 手数料
   - プラットフォーム: 手数料
   ↓
4. Webhook受信: payment_intent.succeeded（Transfer不要）
```

### メリット

- ✅ プラットフォームがリスクを負わない（Connectアカウントに直接Charge）
- ✅ 手数料が自動的に計算される（`application_fee_amount`）
- ✅ Transfer処理が不要（自動的に分割入金）
- ✅ よりシンプルな実装

### デメリット

- ⚠️ インフルエンサーのConnectアカウントがオンボーディング完了している必要がある
- ⚠️ 一部の国では利用できない可能性がある

### 実装例

```typescript
// 入札時: PaymentIntent作成
const paymentIntent = await stripe.paymentIntents.create({
  amount: Math.round(amount),
  currency: 'jpy',
  customer: customerId,
  payment_method: defaultPaymentMethodId,
  capture_method: 'manual',
  confirm: true,
  off_session: true,
  // Destination Charges用の設定
  on_behalf_of: influencerConnectAccountId, // インフルエンサーのConnectアカウントID
  application_fee_amount: Math.round(amount * 0.2), // プラットフォーム手数料（20%）
  transfer_data: {
    destination: influencerConnectAccountId,
  },
  metadata: {
    auction_id: auctionId,
    user_id: userId,
    influencer_id: influencerUserId,
  },
});

// Talk完了時: Capture実行（Transfer処理不要）
const capturedPayment = await stripe.paymentIntents.capture(paymentIntentId);
// → 自動的に分割入金される
```

---

## 提案2: 現在の方式を維持し、Capture実行時に即座にTransfer実行

### 概要

現在のDirect Charges方式を維持し、Webhookを待たずにCapture実行直後にTransferを実行する方式です。

### フロー

```
1. 入札時: PaymentIntent作成（プラットフォームアカウント）
   ↓
2. Talk完了時: Capture実行
   ↓
3. プラットフォームアカウントに即座に入金
   ↓
4. 即座にTransfer実行（Webhookを待たない）
   ↓
5. インフルエンサーに送金完了
```

### メリット

- ✅ 既存の実装を大きく変更しない
- ✅ 即座にTransfer実行できる
- ✅ プラットフォームアカウントの残高を確認してから送金できる

### デメリット

- ⚠️ プラットフォームがリスクを負う（入金後に送金）
- ⚠️ 手数料計算を手動で行う必要がある
- ⚠️ Transfer処理が追加で必要

### 実装例

```typescript
// Talk完了時: Capture実行
const capturedPayment = await stripe.paymentIntents.capture(paymentIntentId);

// 即座にTransfer実行（Webhookを待たない）
const platformFee = Math.round(bidAmount * 0.2);
const influencerPayout = bidAmount - platformFee;

const transfer = await stripe.transfers.create({
  amount: Math.round(influencerPayout),
  currency: 'jpy',
  destination: influencerConnectAccountId,
  transfer_group: auctionId || purchasedSlotId,
});

// payment_transactionsに記録
await supabase.from('payment_transactions').insert({
  purchased_slot_id: purchasedSlotId,
  stripe_payment_intent_id: capturedPayment.id,
  stripe_transfer_id: transfer.id,
  amount: bidAmount,
  platform_fee: platformFee,
  influencer_payout: influencerPayout,
  status: 'captured',
});
```

---

## 比較表

| 項目 | Destination Charges | Direct Charges + 即時Transfer |
|------|-------------------|---------------------------|
| プラットフォームリスク | なし（Connectアカウントに直接Charge） | あり（入金後に送金） |
| 手数料計算 | 自動（`application_fee_amount`） | 手動計算 |
| Transfer処理 | 不要（自動分割） | 必要 |
| 実装の複雑さ | シンプル | やや複雑 |
| 既存実装への影響 | 大きい（PaymentIntent作成を変更） | 小さい（Capture処理のみ変更） |
| オンボーディング要件 | 必須（完了している必要がある） | 不要（Transfer実行時のみ必要） |

---

## 推奨実装

### 推奨: 提案1（Destination Charges方式）

**理由**:
1. プラットフォームがリスクを負わない
2. 手数料が自動的に計算される
3. Transfer処理が不要でシンプル
4. Stripeの推奨方式

**実装手順**:
1. PaymentIntent作成時に`on_behalf_of`と`application_fee_amount`を追加
2. Capture処理からTransfer処理を削除
3. Webhook処理からTransfer処理を削除
4. マイページの売上表示ロジックを更新（`application_fee_amount`を使用）

**注意点**:
- インフルエンサーのConnectアカウントがオンボーディング完了している必要がある
- オンボーディング未完了の場合は、従来の方式にフォールバック

---

## 実装の詳細

### フェーズ1: PaymentIntent作成時の変更

**現在の実装**:
```typescript
// backend/src/server.ts (line 320-332)
const paymentIntent = await stripe.paymentIntents.create({
  amount: Math.round(amount),
  currency: 'jpy',
  customer: customerId,
  payment_method: defaultPaymentMethodId,
  capture_method: 'manual',
  confirm: true,
  off_session: true,
  metadata: {
    auction_id: auctionId,
    user_id: userId,
  },
});
```

**変更後**:
```typescript
// インフルエンサーのConnectアカウントIDを取得
const { data: influencer } = await supabase
  .from('users')
  .select('stripe_connect_account_id')
  .eq('id', influencerUserId)
  .single();

if (influencer?.stripe_connect_account_id) {
  // Destination Charges方式
  const platformFee = Math.round(amount * 0.2);
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
  // フォールバック: 従来の方式（オンボーディング未完了の場合）
  const paymentIntent = await stripe.paymentIntents.create({
    // 現在の実装
  });
}
```

### フェーズ2: Capture処理の変更

**現在の実装**:
```typescript
// backend/src/services/paymentCapture.ts (line 426)
capturedPayment = await stripe.paymentIntents.capture(paymentIntentId);
// → Transfer処理はWebhookで実行
```

**変更後**:
```typescript
// Destination Charges方式の場合、Transfer処理は不要
capturedPayment = await stripe.paymentIntents.capture(paymentIntentId);
// → 自動的に分割入金される

// payment_transactionsに記録（Transfer IDは不要）
await supabase.from('payment_transactions').insert({
  purchased_slot_id: purchasedSlotId,
  stripe_payment_intent_id: capturedPayment.id,
  stripe_charge_id: chargeId,
  amount: bidAmount,
  platform_fee: capturedPayment.application_fee_amount / 100, // 自動計算された手数料
  influencer_payout: bidAmount - (capturedPayment.application_fee_amount / 100),
  status: 'captured',
  // stripe_transfer_idは不要（自動分割のため）
});
```

### フェーズ3: Webhook処理の変更

**現在の実装**:
```typescript
// backend/src/server.ts (line 1072-1158)
case 'payment_intent.succeeded':
  // Transfer処理を実行
  const transfer = await stripe.transfers.create({...});
```

**変更後**:
```typescript
case 'payment_intent.succeeded':
  // Destination Charges方式の場合、Transfer処理は不要
  // payment_transactionsの記録のみ（Capture処理で既に記録済みの可能性がある）
  console.log('✅ 決済成功（自動分割入金済み）');
  break;
```

---

## 移行計画

### ステップ1: オンボーディング完了率の確認

```sql
-- オンボーディング完了率を確認
SELECT 
  COUNT(*) as total_influencers,
  COUNT(stripe_connect_account_id) as connected_accounts,
  COUNT(CASE WHEN stripe_connect_account_status = 'active' THEN 1 END) as active_accounts
FROM users
WHERE is_influencer = true;
```

### ステップ2: 段階的移行

1. **Phase 1**: オンボーディング完了済みのインフルエンサーに対してDestination Charges方式を適用
2. **Phase 2**: オンボーディング未完了のインフルエンサーに対して従来の方式を維持
3. **Phase 3**: 全インフルエンサーのオンボーディング完了後、Destination Charges方式に統一

### ステップ3: テスト

1. テスト環境でDestination Charges方式をテスト
2. オンボーディング完了済みのインフルエンサーで実運用テスト
3. 問題がなければ全インフルエンサーに展開

---

## 注意事項

### Destination Charges方式の制約

1. **オンボーディング要件**: インフルエンサーのConnectアカウントがオンボーディング完了している必要がある
2. **国・地域の制約**: 一部の国・地域では利用できない可能性がある
3. **手数料の計算**: `application_fee_amount`は整数（円単位）で指定する必要がある

### フォールバック戦略

オンボーディング未完了のインフルエンサーの場合：
- 従来のDirect Charges方式を使用
- オンボーディング完了後にDestination Charges方式に移行

---

## まとめ

**推奨実装**: Destination Charges方式

**メリット**:
- プラットフォームがリスクを負わない
- 手数料が自動的に計算される
- Transfer処理が不要でシンプル

**実装のポイント**:
- PaymentIntent作成時に`on_behalf_of`と`application_fee_amount`を指定
- Capture実行時に自動的に分割入金される
- Webhook処理からTransfer処理を削除

**移行計画**:
- 段階的に移行（オンボーディング完了済みから開始）
- フォールバック戦略を用意（オンボーディング未完了の場合）

