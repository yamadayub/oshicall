# マイページ売上サマリー表示ロジック詳細

## データフロー概要

```
フロントエンド (MyPage.tsx)
  ↓
InfluencerEarningsDashboard コンポーネント
  ↓
getInfluencerEarnings() API呼び出し
  ↓
バックエンド (/api/stripe/influencer-earnings)
  ↓
Stripe API + payment_transactions DB
  ↓
レスポンス返却
  ↓
フロントエンド表示
```

## 1. フロントエンド側の実装

### 1.1 MyPage.tsx

**場所**: `src/pages/MyPage.tsx` (line 1338-1341)

```typescript
{stripeAccountStatus === 'active' && (
  <div className="bg-gradient-to-r from-pink-50 via-purple-50 to-indigo-100 border-b-2 border-blue-200 p-6">
    <InfluencerEarningsDashboard authUserId={supabaseUser.auth_user_id || supabaseUser.id} />
  </div>
)}
```

**条件**: Stripe Connect Accountのステータスが`active`の場合のみ表示

### 1.2 InfluencerEarningsDashboard コンポーネント

**場所**: `src/components/InfluencerEarningsDashboard.tsx`

**データ取得**:
```typescript
const loadEarnings = async () => {
  try {
    setIsLoading(true);
    setError('');
    const data = await getInfluencerEarnings(authUserId);
    setEarnings(data);
  } catch (err: any) {
    console.error('売上データ取得エラー:', err);
    setError(err.message || '売上データの取得に失敗しました');
  } finally {
    setIsLoading(false);
  }
};
```

**表示項目**:
- `totalEarnings`: 総売上
- `pendingPayout`: 入金予定額
- `availableBalance`: 出金可能額
- `recentTransactions`: 直近5件の取引履歴
- `monthlyStats`: 月次統計

## 2. API呼び出し

### 2.1 getInfluencerEarnings()

**場所**: `src/api/stripe.ts`

```typescript
export const getInfluencerEarnings = async (authUserId: string) => {
  const response = await fetch(`${getBackendUrl()}/api/stripe/influencer-earnings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ authUserId }),
  });

  if (!response.ok) {
    throw new Error('売上データの取得に失敗しました');
  }

  return response.json();
};
```

## 3. バックエンド側の実装

### 3.1 エンドポイント

**場所**: `backend/src/server.ts` (line 800-1093)

**エンドポイント**: `POST /api/stripe/influencer-earnings`

**リクエストボディ**:
```json
{
  "authUserId": "string"
}
```

### 3.2 処理フロー

#### ステップ1: ユーザー情報取得

```typescript
const { data: user, error: userError } = await supabase
  .from('users')
  .select('id, stripe_connect_account_id')
  .eq('auth_user_id', authUserId)
  .single();
```

**取得データ**:
- `user.id`: ユーザーID
- `user.stripe_connect_account_id`: Stripe Connect Account ID

#### ステップ2: payment_transactionsから取引データ取得

```typescript
const { data: transactions, error: txError } = await supabase
  .from('payment_transactions')
  .select(`
    *,
    purchased_slots!inner (
      influencer_user_id,
      fan_user_id,
      call_slots (
        title
      )
    )
  `)
  .eq('purchased_slots.influencer_user_id', user.id)
  .eq('status', 'captured')
  .order('created_at', { ascending: false });
```

**取得条件**:
- `purchased_slots.influencer_user_id` = 現在のユーザーID
- `status` = 'captured' (Capture済み)

**取得データ**:
- すべての`payment_transactions`カラム
- 関連する`purchased_slots`情報
- 関連する`call_slots`情報（タイトルなど）

#### ステップ3: Stripe Balance Transactions APIから取得

**条件**: `user.stripe_connect_account_id`が存在する場合

```typescript
const balanceTransactions = await stripe.balanceTransactions.list({
  limit: 100,
}, {
  stripeAccount: user.stripe_connect_account_id,
});
```

**取得データ**:
- Connect Account側のすべての取引履歴（Transfer、Charge、Application Feeなど）

#### ステップ4: 総売上（totalEarnings）の計算

**方法1: Stripe Balance Transactions APIから取得（優先）**

```typescript
const filteredTransactions = balanceTransactions.data.filter(bt => {
  const isTransferOrCharge = bt.type === 'transfer' || bt.type === 'charge';
  const isPositive = bt.amount > 0;
  const isJpy = bt.currency === 'jpy';
  const isSuccessful = bt.status === 'available' || bt.status === 'pending';
  return isTransferOrCharge && isPositive && isJpy && isSuccessful;
});

totalEarningsFromStripe = filteredTransactions.reduce((sum, bt) => sum + (bt.amount / 100), 0);
```

**フィルタリング条件**:
- `type` = 'transfer' または 'charge'
- `amount` > 0 (正の値)
- `currency` = 'jpy'
- `status` = 'available' または 'pending'

**方法2: payment_transactionsから集計（フォールバック）**

```typescript
// Transfer済み（Direct Charges方式）
const totalEarningsFromDB = transactions.filter(tx => 
  tx.stripe_transfer_id !== null && 
  tx.stripe_transfer_id !== undefined &&
  tx.stripe_transfer_id !== 'auto_split'
).reduce((sum, tx) => sum + (tx.influencer_payout || 0), 0);

// 自動分割済み（Destination Charges方式）
const autoSplitEarnings = transactions.filter(tx => 
  tx.stripe_transfer_id === 'auto_split'
).reduce((sum, tx) => sum + (tx.influencer_payout || 0), 0);

totalEarnings = totalEarningsFromDB + autoSplitEarnings;
```

**フォールバック条件**:
- `stripeEarningsError`が存在する
- `user.stripe_connect_account_id`が存在しない
- `transactions`が空
- Stripeから取得したデータが0で、`transactions`にデータがある場合

#### ステップ5: 入金予定額（pendingPayout）の計算

**方法1: Stripe Balance Transactions APIから取得（優先）**

```typescript
pendingPayoutFromStripe = balanceTransactions.data
  .filter(bt => {
    const isTransferOrCharge = bt.type === 'transfer' || bt.type === 'charge';
    const isPositive = bt.amount > 0;
    const isJpy = bt.currency === 'jpy';
    const isPending = bt.status === 'pending';
    return isTransferOrCharge && isPositive && isJpy && isPending;
  })
  .reduce((sum, bt) => sum + (bt.amount / 100), 0);
```

**フィルタリング条件**:
- `type` = 'transfer' または 'charge'
- `amount` > 0
- `currency` = 'jpy'
- `status` = 'pending' (保留中)

**方法2: payment_transactionsから集計（フォールバック）**

```typescript
pendingPayout = transactions.filter(tx => 
  tx.stripe_transfer_id === null || tx.stripe_transfer_id === undefined
).reduce((sum, tx) => sum + (tx.influencer_payout || 0), 0);
```

**条件**:
- `stripe_transfer_id`が`null`または`undefined`

#### ステップ6: 出金可能額（availableBalance）の計算

```typescript
const balance = await stripe.balance.retrieve({
  stripeAccount: user.stripe_connect_account_id,
});

availableBalance = balance.available.reduce((sum, b) => sum + b.amount, 0) / 100;
```

**取得方法**: Stripe Balance APIから直接取得

#### ステップ7: 月次統計の計算

```typescript
const currentMonthTx = transactions.filter(tx => {
  const txDate = new Date(tx.created_at);
  const isCurrentMonth = txDate >= currentMonthStart;
  const isTransferred = tx.stripe_transfer_id !== null && tx.stripe_transfer_id !== 'auto_split';
  const isAutoSplit = tx.stripe_transfer_id === 'auto_split';
  return isCurrentMonth && (isTransferred || isAutoSplit);
});

const currentMonthEarnings = currentMonthTx.reduce((sum, tx) => sum + (tx.influencer_payout || 0), 0);
```

**計算方法**: `payment_transactions`から月ごとに集計

### 3.3 レスポンス形式

```typescript
{
  totalEarnings: number,      // 総売上（Transfer済み + 自動分割済み）
  pendingPayout: number,      // 入金予定額（Capture済み、Transfer未実施）
  availableBalance: number,   // Stripe残高（出金可能額）
  pendingBalance: number,     // Stripe保留中（参考情報）
  recentTransactions: Array<{
    id: string,
    talkTitle: string,
    amount: number,
    platformFee: number,
    grossAmount: number,
    completedAt: string,
    status: string,
  }>,
  monthlyStats: {
    currentMonth: {
      earnings: number,
      callCount: number,
      averagePrice: number,
    },
    previousMonth: {
      earnings: number,
      callCount: number,
    },
  },
  totalCallCount: number,
  balanceError?: string | null,
  stripeEarningsError?: string | null,
}
```

## 4. 表示ロジックの問題点

### 4.1 総売上の問題

**現在の実装**:
- Stripe Balance Transactions APIから`transfer`と`charge`を集計
- フォールバック条件が厳しすぎる可能性

**問題点**:
- Balance Transactions APIが空の配列を返す場合、フォールバック処理が実行されるが、条件が複雑
- `totalEarningsFromStripe === 0 && pendingPayoutFromStripe === 0 && transactions.length > 0`の条件でフォールバックが実行されるが、実際にはStripeにデータがない可能性もある

### 4.2 入金予定額の問題

**現在の実装**:
- Stripe Balance Transactions APIから`pending`ステータスの取引を集計
- フォールバック: `payment_transactions`から`stripe_transfer_id`が`null`のものを集計

**問題点**:
- Balance Transactions APIの`pending`ステータスと`payment_transactions`の`stripe_transfer_id`が`null`の条件が一致しない可能性
- Destination Charges方式の場合は`stripe_transfer_id`が`'auto_split'`になるため、入金予定額に含まれない

### 4.3 出金可能額の問題

**現在の実装**:
- Stripe Balance APIから直接取得

**問題点**:
- 特に問題なし（Stripe APIから直接取得しているため正確）

## 5. 推奨される修正方針

### 5.1 総売上の修正

**方針**: `payment_transactions`からの集計を優先し、Stripe APIは検証用に使用

```typescript
// payment_transactionsから集計（優先）
const totalEarningsFromDB = transactions.filter(tx => 
  tx.stripe_transfer_id !== null && 
  tx.stripe_transfer_id !== undefined &&
  tx.stripe_transfer_id !== 'auto_split'
).reduce((sum, tx) => sum + (tx.influencer_payout || 0), 0);

const autoSplitEarnings = transactions.filter(tx => 
  tx.stripe_transfer_id === 'auto_split'
).reduce((sum, tx) => sum + (tx.influencer_payout || 0), 0);

totalEarnings = totalEarningsFromDB + autoSplitEarnings;

// Stripe APIから取得した値と比較（検証用）
if (totalEarningsFromStripe > 0) {
  console.log('🔍 検証: Stripe APIとDBの比較', {
    fromDB: totalEarnings,
    fromStripe: totalEarningsFromStripe,
    difference: totalEarnings - totalEarningsFromStripe,
  });
}
```

### 5.2 入金予定額の修正

**方針**: `payment_transactions`からの集計を優先

```typescript
// payment_transactionsから集計（優先）
pendingPayout = transactions.filter(tx => {
  // Direct Charges方式のみ（Destination Charges方式は自動分割済みのため除外）
  return tx.stripe_transfer_id === null || tx.stripe_transfer_id === undefined;
}).reduce((sum, tx) => sum + (tx.influencer_payout || 0), 0);
```

### 5.3 出金可能額の修正

**現在の実装で問題なし**（変更不要）

