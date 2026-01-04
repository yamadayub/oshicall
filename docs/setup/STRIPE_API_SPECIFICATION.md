# Stripe API仕様書（Connect Account用）

## 概要

Stripe Connect Accountの売上データを取得するためのAPI仕様です。
Stripeの公式ドキュメントに基づいて、各エンドポイントの詳細を説明します。

## 1. Balance API（残高情報取得）

### エンドポイント

```
GET /v1/balance
```

### パラメーター

**Connect Account用の場合**:
- `stripeAccount` (ヘッダーまたはオプション): Connect Account ID（例: `acct_xxxxx`）

**クエリパラメーター**: なし

### リクエスト例（Stripe Node.js SDK）

```typescript
// 正しい方法: stripeAccountは第2引数のオプションに含める
const balance = await stripe.balance.retrieve({}, {
  stripeAccount: 'acct_1SKrTLDYeJjwCo3O',
});
```

### レスポンス構造

```typescript
{
  object: 'balance',
  available: [
    {
      amount: 10000,        // JPYの場合: 円単位（10000 = 10000円）
      currency: 'jpy',     // 通貨コード
      source_types: {
        card: 10000
      }
    }
  ],
  connect_reserved: [
    {
      amount: 0,
      currency: 'jpy'
    }
  ],
  instant_available: [
    {
      amount: 0,
      currency: 'jpy'
    }
  ],
  issuing: {
    available: []
  },
  pending: [
    {
      amount: 5000,         // セント単位（例: 5000 = 50.00円）
      currency: 'jpy',
      source_types: {
        card: 5000
      }
    }
  ],
  livemode: false
}
```

### 主要フィールド

- **`available`**: 出金可能な残高（即座に出金可能）
- **`pending`**: 入金予定の残高（保留中、まだ出金できない）
- **`connect_reserved`**: Connect用に予約されている残高
- **`instant_available`**: 即時出金可能な残高

### 用途

- **出金可能額**: `available`の合計を取得
- **入金予定額**: `pending`の合計を取得（ただし、Balance Transactions APIの方が正確）

## 2. Balance Transactions API（取引履歴取得）

### エンドポイント

```
GET /v1/balance_transactions
```

### パラメーター

**Connect Account用の場合**:
- `stripeAccount` (ヘッダーまたはオプション): Connect Account ID

**クエリパラメーター**:
- `limit` (integer, オプション): 取得する取引の最大数（デフォルト: 10、最大: 100）
- `starting_after` (string, オプション): 指定した取引IDの後から取得（ページネーション用）
- `ending_before` (string, オプション): 指定した取引IDの前まで取得（ページネーション用）
- `created` (integer | range, オプション): 作成日時のフィルタリング
  - 単一値: `created: 1609459200` (UNIXタイムスタンプ)
  - 範囲: `created: { gte: 1609459200, lte: 1609545600 }`
- `type` (string, オプション): 取引タイプでフィルタリング
  - 例: `type: 'charge'`, `type: 'transfer'`
- `payout` (string, オプション): 特定のPayout IDに関連する取引を取得

### リクエスト例（Stripe Node.js SDK）

```typescript
// 基本的な取得
const balanceTransactions = await stripe.balanceTransactions.list({
  limit: 100,
}, {
  stripeAccount: 'acct_1SKrTLDYeJjwCo3O',
});

// フィルタリング付き
const balanceTransactions = await stripe.balanceTransactions.list({
  limit: 100,
  type: 'charge',  // chargeのみ取得
}, {
  stripeAccount: 'acct_1SKrTLDYeJjwCo3O',
});
```

### レスポンス構造

```typescript
{
  object: 'list',
  data: [
    {
      id: 'txn_1ABC123...',           // Balance Transaction ID
      object: 'balance_transaction',
      amount: 10000,                   // JPYの場合: 円単位（10000 = 10000円）
      available_on: 1609459200,        // 出金可能になる日時（UNIXタイムスタンプ）
      created: 1609372800,             // 作成日時（UNIXタイムスタンプ）
      currency: 'jpy',                 // 通貨コード
      description: 'Transfer from platform',  // 説明
      exchange_rate: null,             // 為替レート（マルチカレンシーの場合）
      fee: 0,                          // 手数料（JPYの場合は円単位）
      fee_details: [],                 // 手数料の詳細
      net: 10000,                       // 手数料を差し引いた金額（JPYの場合は円単位）
      reporting_category: 'charge',    // レポートカテゴリ
      source: 'ch_1ABC123...',         // 関連するCharge IDまたはTransfer ID
      status: 'available',             // ステータス: 'available' | 'pending'
      type: 'transfer'                  // 取引タイプ
    }
  ],
  has_more: false,                     // さらにデータがあるか
  url: '/v1/balance_transactions'
}
```

### 主要フィールド

#### `type`（取引タイプ）

Connect Accountで使用される主要なタイプ:

- **`payment`**: 直接Charge（Destination Charges方式の場合）**注意: `charge`ではなく`payment`が返される**
- **`transfer`**: プラットフォームからのTransfer（Direct Charges方式の場合）
- **`charge`**: Charge（プラットフォーム側で使用）
- **`application_fee`**: プラットフォーム手数料（プラットフォーム側に記録される）
- **`refund`**: 返金
- **`adjustment`**: 調整
- **`payout`**: 出金
- **`payout_failure`**: 出金失敗
- **`payout_cancel`**: 出金キャンセル

**重要**: Connect AccountのBalance Transactions APIでは、Destination Charges方式の場合、`type: 'payment'`が返されます（`type: 'charge'`ではありません）。

#### `status`（ステータス）

- **`available`**: 出金可能（確定済み）
- **`pending`**: 保留中（まだ出金できない）

#### `amount`（金額）

- **単位**: セント単位（例: 10000 = 100.00円）
- **符号**: 
  - 正の値: 入金
  - 負の値: 出金・手数料・返金など

### 用途

#### 総売上の計算

```typescript
// すべての入金（transfer + payment）を集計
// 注意: Destination Charges方式の場合、type='payment'が返される
const totalEarnings = balanceTransactions.data
  .filter(bt => {
    const isTransferOrPayment = bt.type === 'transfer' || bt.type === 'payment';
    const isPositive = bt.amount > 0;  // 入金のみ
    const isJpy = bt.currency === 'jpy';
    const isAvailable = bt.status === 'available';  // 確定済みのみ
    return isTransferOrPayment && isPositive && isJpy && isAvailable;
  })
  .reduce((sum, bt) => sum + (bt.amount / 100), 0);
```

#### 入金予定額の計算

```typescript
// pendingステータスの入金を集計
// 注意: Destination Charges方式の場合、type='payment'が返される
const pendingPayout = balanceTransactions.data
  .filter(bt => {
    const isTransferOrPayment = bt.type === 'transfer' || bt.type === 'payment';
    const isPositive = bt.amount > 0;
    const isJpy = bt.currency === 'jpy';
    const isPending = bt.status === 'pending';  // 保留中のみ
    return isTransferOrPayment && isPositive && isJpy && isPending;
  })
  .reduce((sum, bt) => sum + (bt.amount / 100), 0);
```

## 3. 実装上の注意点

### 3.1 ページネーション

`limit`の最大値は100です。100件を超える取引がある場合は、`starting_after`を使用してページネーションする必要があります。

```typescript
let allTransactions = [];
let hasMore = true;
let startingAfter = null;

while (hasMore) {
  const params: any = { limit: 100 };
  if (startingAfter) {
    params.starting_after = startingAfter;
  }

  const response = await stripe.balanceTransactions.list(params, {
    stripeAccount: user.stripe_connect_account_id,
  });

  allTransactions = allTransactions.concat(response.data);
  hasMore = response.has_more;
  
  if (hasMore && response.data.length > 0) {
    startingAfter = response.data[response.data.length - 1].id;
  } else {
    hasMore = false;
  }
}
```

### 3.2 金額の単位変換

**重要**: JPY（日本円）はzero-decimal currency（ゼロ小数通貨）のため、Stripe APIは金額を円単位で返します。**100で割る必要はありません。**

```typescript
// JPYの場合（変換不要）
const amountInYen = balanceTransaction.amount; // 既に円単位

// USDなどの場合（100で割る）
const amountInDollars = balanceTransaction.amount / 100; // セント単位からドル単位に変換
```

**Zero-decimal currencies**（ゼロ小数通貨）:
- JPY（日本円）
- KRW（韓国ウォン）
- VND（ベトナムドン）
- など

これらの通貨は、最小通貨単位が1であるため、Stripe APIは既に円単位で返します。

### 3.3 タイムゾーン

`created`と`available_on`はUNIXタイムスタンプ（UTC）です。日本時間に変換する場合は、+9時間（32400秒）を加算します。

```typescript
const jstTimestamp = balanceTransaction.created + (9 * 60 * 60);
const jstDate = new Date(jstTimestamp * 1000);
```

### 3.4 エラーハンドリング

```typescript
try {
  const balance = await stripe.balance.retrieve({
    stripeAccount: user.stripe_connect_account_id,
  });
} catch (error: any) {
  if (error.type === 'StripeAuthenticationError') {
    // 認証エラー
  } else if (error.type === 'StripeAPIError') {
    // APIエラー
  } else if (error.type === 'StripeConnectionError') {
    // 接続エラー
  }
}
```

## 4. 推奨される実装

### 4.1 総売上の取得

```typescript
// Balance Transactions APIから取得
const balanceTransactions = await stripe.balanceTransactions.list({
  limit: 100,
  type: 'charge',  // または 'transfer'、または両方
}, {
  stripeAccount: user.stripe_connect_account_id,
});

// availableステータスの入金のみを集計
// 注意: Destination Charges方式の場合、type='payment'が返される
// JPYはzero-decimal currencyのため、amountは既に円単位（100で割る必要なし）
const totalEarnings = balanceTransactions.data
  .filter(bt => 
    (bt.type === 'transfer' || bt.type === 'payment') &&
    bt.amount > 0 &&
    bt.currency === 'jpy' &&
    bt.status === 'available'
  )
  .reduce((sum, bt) => sum + bt.amount, 0);
```

### 4.2 入金予定額の取得

```typescript
// Balance Transactions APIから取得
const balanceTransactions = await stripe.balanceTransactions.list({
  limit: 100,
}, {
  stripeAccount: user.stripe_connect_account_id,
});

// pendingステータスの入金のみを集計
// 注意: Destination Charges方式の場合、type='payment'が返される
// JPYはzero-decimal currencyのため、amountは既に円単位（100で割る必要なし）
const pendingPayout = balanceTransactions.data
  .filter(bt => 
    (bt.type === 'transfer' || bt.type === 'payment') &&
    bt.amount > 0 &&
    bt.currency === 'jpy' &&
    bt.status === 'pending'
  )
  .reduce((sum, bt) => sum + bt.amount, 0);
```

### 4.3 出金可能額の取得

```typescript
// Balance APIから取得
const balance = await stripe.balance.retrieve({
  stripeAccount: user.stripe_connect_account_id,
});

// availableの合計を計算
// JPYはzero-decimal currencyのため、amountは既に円単位（100で割る必要なし）
const availableBalance = balance.available
  .filter(b => b.currency === 'jpy')
  .reduce((sum, b) => sum + b.amount, 0);
```

## 5. 参考リンク

- [Stripe API Reference: Balance](https://stripe.com/docs/api/balance)
- [Stripe API Reference: Balance Transactions](https://stripe.com/docs/api/balance_transactions/list)
- [Stripe Connect: Account Balances](https://stripe.com/docs/connect/account-balances)

