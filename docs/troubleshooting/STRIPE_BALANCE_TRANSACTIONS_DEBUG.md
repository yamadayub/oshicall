# Stripe Balance Transactions API デバッグガイド

## 問題

Stripe APIから取得したデータが0になっている。

## 確認事項

### 1. バックエンドログの確認

Staging環境のログを確認：

```bash
heroku logs --tail --app oshicall-staging | grep -A 50 "Balance Transactions"
```

期待されるログ出力：
- `🔵 Balance Transactions取得:` - 取得した取引数と詳細
- `✅ Balance Transactionsから集計した総売上:` - 集計結果と内訳
- `✅ Balance Transactionsから集計した入金予定額:` - 入金予定額

### 2. フィルタリング条件の確認

現在のフィルタリング条件：
- `type === 'transfer' || type === 'charge'`
- `amount > 0`（入金のみ）
- `currency === 'jpy'`
- `status === 'available' || status === 'pending'`

**問題の可能性**:
- Balance Transactions APIが空の配列を返している
- フィルタリング条件が厳しすぎて、すべての取引が除外されている
- `status`が'available'や'pending'以外の値になっている

### 3. 実際のデータ構造の確認

Stripe Dashboardで以下を確認：
1. Connect AccountのBalance Transactions
2. 実際の取引の`type`、`status`、`currency`、`amount`
3. これらの値がフィルタリング条件と一致しているか

### 4. pendingBalance: 4 について

`pendingBalance: 4`は、4セント（0.04円）を意味する可能性があります。
Balance APIから取得したデータはセント単位なので、100で割って円単位に変換する必要があります。

現在のコード：
```typescript
pendingBalance = balance.pending.reduce((sum, b) => sum + b.amount, 0) / 100;
```

これは正しい実装ですが、`pendingBalance: 4`が表示されている場合、`balance.pending`の`amount`が400セント（4円）である可能性があります。

## デバッグ手順

### ステップ1: バックエンドログを確認

```bash
heroku logs --tail --app oshicall-staging
```

以下を確認：
- `🔵 Balance Transactions取得:` の`count`と`transactions`
- 各取引の`type`、`amount`、`currency`、`status`
- `✅ Balance Transactionsから集計した総売上:` の`allTransactionsCount`と`filteredTransactionsCount`

### ステップ2: フィルタリング前のデータを確認

ログに出力されている`transactions`配列を確認し、実際のデータ構造を見る。

### ステップ3: フィルタリング条件を緩和

一時的にフィルタリング条件を緩和して、すべての取引を確認：

```typescript
// デバッグ用：フィルタリング条件を緩和
const allTransactions = balanceTransactions.data || [];
console.log('🔍 デバッグ: すべての取引:', allTransactions.map(bt => ({
  id: bt.id,
  type: bt.type,
  amount: bt.amount,
  currency: bt.currency,
  status: bt.status,
  description: bt.description,
})));
```

### ステップ4: Stripe Dashboardで確認

Stripe Dashboardで以下を確認：
1. Connect AccountのID: `acct_1SKrTLDYeJjwCo3O`
2. Balance Transactionsページ
3. 実際の取引データ

## 予想される原因

1. **Balance Transactions APIが空の配列を返している**
   - Connect Accountに取引がない
   - または、API呼び出しが正しく動作していない

2. **フィルタリング条件が厳しすぎる**
   - `status`が'available'や'pending'以外の値
   - `currency`が'jpy'以外
   - `type`が'transfer'や'charge'以外

3. **金額の単位変換の問題**
   - セント単位と円単位の変換が正しくない（既に修正済み）

## 次のステップ

1. バックエンドログを確認
2. Stripe Dashboardで実際のデータを確認
3. フィルタリング条件を確認・調整
4. 必要に応じて、フィルタリング条件を緩和してテスト

