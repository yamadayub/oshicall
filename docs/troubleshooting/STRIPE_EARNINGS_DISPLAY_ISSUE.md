# Stripe売上表示不一致の問題分析

## 問題
Stripeダッシュボードとアプリケーションで表示される「総売上」「入金予定額」「出金可能額」が一致しない。

## 原因分析

### 1. 総売上（totalEarnings）の問題

**Stripeダッシュボードの表示**:
- Connect Accountの「総売上」は、すべての成功したChargeの合計額を表示
- Destination Charges方式: ChargeはConnect Account側に直接入金されるため、Balance Transactionsに`charge`として記録
- Direct Charges方式: TransferがConnect Account側に記録されるため、Balance Transactionsに`transfer`として記録

**現在の実装の問題**:
- Balance Transactions APIから`transfer`と`charge`を集計しているが、これがStripeダッシュボードの「総売上」と一致するか確認が必要
- Stripeダッシュボードでは、Connect Accountの「総売上」は通常、すべての成功したChargeの合計を表示しますが、Transferは含まれない場合がある

**修正方針**:
- Balance Transactions APIから`charge`のみを集計（Stripeダッシュボードの「総売上」に合わせる）
- または、`transfer`と`charge`の両方を集計（より包括的な表示）

### 2. 入金予定額（pendingPayout）の問題

**Stripeダッシュボードの表示**:
- Connect Accountの「入金予定額」は、保留中の取引や保留中の残高を表示
- 通常、`balance.pending`に含まれる金額が「入金予定額」として表示される

**現在の実装の問題**:
- `payment_transactions`から`stripe_transfer_id`が`null`のものを集計しているが、これがStripeダッシュボードの「入金予定額」と一致するか確認が必要
- Stripeダッシュボードでは、Connect Accountの「入金予定額」は通常、`balance.pending`から取得される

**修正方針**:
- `balance.pending`から取得（Stripeダッシュボードの「入金予定額」に合わせる）
- または、`payment_transactions`から`stripe_transfer_id`が`null`のものを集計（より詳細な表示）

### 3. 出金可能額（availableBalance）の問題

**Stripeダッシュボードの表示**:
- Connect Accountの「出金可能額」は、`balance.available`から取得される
- これは、銀行口座に送金可能な金額を表示

**現在の実装**:
- `balance.available`から取得しているため、これは正しい

## 修正提案

### 修正案1: Stripeダッシュボードに完全に合わせる

```typescript
// 総売上: Balance Transactionsからchargeのみを集計
totalEarningsFromStripe = balanceTransactions.data
  .filter(bt => bt.type === 'charge' && bt.amount > 0 && bt.currency === 'jpy')
  .reduce((sum, bt) => sum + (bt.amount / 100), 0);

// 入金予定額: balance.pendingから取得
pendingPayoutFromStripe = balance.pending.reduce((sum, b) => sum + b.amount, 0) / 100;

// 出金可能額: balance.availableから取得（現在の実装のまま）
availableBalance = balance.available.reduce((sum, b) => sum + b.amount, 0) / 100;
```

### 修正案2: より包括的な表示（推奨）

```typescript
// 総売上: Balance Transactionsからtransferとchargeの両方を集計
totalEarningsFromStripe = balanceTransactions.data
  .filter(bt => {
    const isTransferOrCharge = bt.type === 'transfer' || bt.type === 'charge';
    const isPositive = bt.amount > 0;
    const isJpy = bt.currency === 'jpy';
    const isSuccessful = bt.status === 'available' || bt.status === 'pending';
    return isTransferOrCharge && isPositive && isJpy && isSuccessful;
  })
  .reduce((sum, bt) => sum + (bt.amount / 100), 0);

// 入金予定額: payment_transactionsからstripe_transfer_idがnullのものを集計
// （より詳細な情報を表示）
pendingPayoutFromStripe = (pendingTransactions || [])
  .filter(tx => {
    // Destination Charges方式は除外（自動分割済みのため）
    return true; // PaymentIntentを確認して除外
  })
  .reduce((sum, tx) => sum + (tx.influencer_payout || 0), 0);

// 出金可能額: balance.availableから取得（現在の実装のまま）
availableBalance = balance.available.reduce((sum, b) => sum + b.amount, 0) / 100;
```

## 確認手順

1. **Stripeダッシュボードで確認**:
   - Connect Accountの「総売上」を確認
   - Connect Accountの「入金予定額」を確認
   - Connect Accountの「出金可能額」を確認

2. **アプリケーションで確認**:
   - `/api/stripe/influencer-earnings`エンドポイントのレスポンスを確認
   - ログを確認して、Balance Transactions APIから取得したデータを確認

3. **比較**:
   - Stripeダッシュボードとアプリケーションの表示を比較
   - 不一致がある場合は、ログを確認して原因を特定

## 次のステップ

1. 修正案1または修正案2を実装
2. Staging環境でテスト
3. Stripeダッシュボードとアプリケーションの表示を比較
4. 必要に応じて調整

