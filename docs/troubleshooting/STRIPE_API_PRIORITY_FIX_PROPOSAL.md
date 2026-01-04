# Stripe API優先表示への修正方針

## 現状の問題

1. フォールバック条件が複雑で、Stripe APIから取得したデータが0の場合にフォールバック処理が実行されている
2. Stripe APIを優先すべきだが、現在は条件によってフォールバックが実行される可能性がある

## 修正方針

### 1. Stripe APIを優先する

**原則**:
- Stripe APIから取得できた場合は、そのデータを使用
- エラーが発生した場合のみ、フォールバック処理を実行

**修正前**:
```typescript
const shouldUseFallback = stripeEarningsError || 
                         !user.stripe_connect_account_id || 
                         !transactions || 
                         transactions.length === 0 ||
                         (totalEarningsFromStripe === 0 && pendingPayoutFromStripe === 0 && transactions.length > 0);
```

**修正後**:
```typescript
// Stripe APIから取得できた場合は優先（エラーの場合のみフォールバック）
const shouldUseFallback = stripeEarningsError || !user.stripe_connect_account_id;
```

### 2. ログ出力の強化

**バックエンド**:
- Stripe APIから取得したデータの詳細をログに出力
- フォールバック処理が実行された場合の理由をログに出力

**フロントエンド**:
- 取得したデータをブラウザのコンソールに表示
- デバッグ用の情報を含める

### 3. レスポンスにデバッグ情報を追加

**レスポンスに含める情報**:
- `dataSource`: データソース（'stripe' または 'database'）
- `stripeData`: Stripe APIから取得した生データ（デバッグ用）
- `debugInfo`: デバッグ情報（取得した取引数、フィルタリング結果など）

## 実装詳細

### バックエンド修正

1. **フォールバック条件の簡素化**
   - エラーまたはConnect Account IDがない場合のみフォールバック

2. **ログ出力の強化**
   - Balance Transactions APIから取得したデータの詳細
   - フィルタリング前後の取引数
   - 集計結果の内訳

3. **レスポンスにデバッグ情報を追加**
   - データソースの明示
   - Stripe APIから取得した生データ（オプション）

### フロントエンド修正

1. **コンソールログの追加**
   - 取得したデータを`console.log`で出力
   - デバッグ情報を含める

2. **エラーハンドリングの改善**
   - Stripe APIから取得できなかった場合のメッセージ表示

## 修正後の動作

### 正常系（Stripe APIから取得成功）

1. Stripe Balance Transactions APIから取引履歴を取得
2. フィルタリングして総売上・入金予定額を計算
3. Stripe Balance APIから出金可能額を取得
4. レスポンスに`dataSource: 'stripe'`を含める
5. フロントエンドでコンソールに表示

### 異常系（Stripe APIから取得失敗）

1. エラーが発生した場合、フォールバック処理を実行
2. `payment_transactions`から集計
3. レスポンスに`dataSource: 'database'`を含める
4. エラーメッセージをログに出力

## 期待される結果

- Stripe APIから取得したデータが優先的に表示される
- ブラウザのコンソールで取得したデータを確認できる
- デバッグが容易になる

