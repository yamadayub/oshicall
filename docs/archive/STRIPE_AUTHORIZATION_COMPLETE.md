# ✅ Stripe与信管理システム完成

## 🎯 実装内容

### 完全な与信管理フロー

```
入札時
  ↓
① 前回の最高入札を取得
  ↓
② 前回入札者の与信をキャンセル（別のユーザーの場合）
  ↓
③ 新しいPaymentIntentを作成（手動キャプチャ）
  ↓
④ 与信確保成功 → カード利用可能額内であることを確認
  ↓
⑤ 入札データをSupabaseに保存
  ↓
⑥ UI更新
```

---

## 🔐 Stripe設定

### PaymentIntent設定
```typescript
{
  amount: 入札金額（円単位）,
  currency: 'jpy',
  customer: 'cus_xxx',
  payment_method: 'pm_xxx',
  capture_method: 'manual',  // 手動キャプチャ（与信のみ）
  confirm: true,             // 即座に確認
  off_session: true,         // オフセッション決済
  metadata: {
    auction_id: 'auction_xxx',
    user_id: 'user_xxx',
  }
}
```

### 与信のステータス
- **requires_capture**: 与信確保済み（決済待ち）
- **canceled**: キャンセル済み
- **succeeded**: 決済完了

---

## 📊 データフロー

### シナリオ1: ユーザーAが最初に入札

```
1. ユーザーA: ¥1,000 で入札
   ↓
2. Payment Intent作成: pi_A（¥1,000）
   ↓
3. 与信確保: ユーザーAのカードに¥1,000ホールド
   ↓
4. bidsテーブルに保存:
   - user_id: A
   - bid_amount: 1000
   - stripe_payment_intent_id: pi_A
   - status: requires_capture
```

### シナリオ2: ユーザーBがより高く入札

```
1. ユーザーB: ¥1,500 で入札
   ↓
2. 前回の最高入札を取得: ユーザーA（pi_A）
   ↓
3. ユーザーAの与信をキャンセル: pi_A → canceled
   ↓
4. ユーザーAのカードホールド解除（自動）
   ↓
5. Payment Intent作成: pi_B（¥1,500）
   ↓
6. 与信確保: ユーザーBのカードに¥1,500ホールド
   ↓
7. bidsテーブルに保存:
   - user_id: B
   - bid_amount: 1500
   - stripe_payment_intent_id: pi_B
   - status: requires_capture
```

### シナリオ3: オークション終了（将来実装）

```
1. オークション終了時刻到達
   ↓
2. 最高入札者を取得: ユーザーB（pi_B）
   ↓
3. ユーザーBの与信を決済確定:
   stripe.paymentIntents.capture(pi_B)
   ↓
4. 実際に請求が確定
   ↓
5. purchased_slotsテーブルに記録
   ↓
6. 他の入札者の与信を全てキャンセル（あれば）
```

---

## 🔍 与信確保の仕組み

### カード利用可能額のチェック

Stripeは与信確保時に自動的にチェック：

```
ユーザーのカード利用可能額: ¥50,000
  ↓
入札額: ¥10,000
  ↓
✅ 与信確保成功 → カードに¥10,000ホールド
  ↓
カード残高: ¥40,000（一時的に減る）
```

### 入札がキャンセルされた場合

```
前回の入札者の与信がキャンセル
  ↓
stripe.paymentIntents.cancel(pi_xxx)
  ↓
カードのホールドが自動解除
  ↓
カード残高: ¥50,000（元に戻る）
```

**重要**: ホールド解除には通常1〜7日かかりますが、テストモードでは即座に解除されます。

---

## 🧪 テストシナリオ

### テスト1: 与信確保の成功

```bash
カード: 4242 4242 4242 4242（成功）
入札額: ¥1,000
↓
✅ Payment Intent作成成功
✅ ¥1,000 で入札しました！
```

### テスト2: カード残高不足（テスト）

```bash
カード: 4000 0000 0000 9995（残高不足）
入札額: ¥100,000,000
↓
❌ Error: Your card has insufficient funds.
```

### テスト3: カード拒否（テスト）

```bash
カード: 4000 0000 0000 0002（拒否）
入札額: ¥1,000
↓
❌ Error: Your card was declined.
```

### テスト4: 前回入札者の与信キャンセル

```
1. ユーザーA: ¥1,000 で入札 → pi_A（requires_capture）
2. ユーザーB: ¥1,500 で入札 → pi_A（canceled）+ pi_B（requires_capture）
3. バックエンドログ:
   🔵 前回の与信をキャンセル: pi_A
   ✅ 前回の与信キャンセル成功
   🔵 Payment Intent作成: { amount: 1500 }
   ✅ Payment Intent作成成功: pi_B
```

---

## 🔐 セキュリティ

### 1. 与信のみ、実際の請求は後
- 入札時: カードに与信を確保（ホールド）
- 実際の請求: オークション終了後に手動確定

### 2. 二重請求の防止
- 前回の入札者の与信を自動キャンセル
- 1つのオークションにつき、1人のみ与信が有効

### 3. カード情報の保護
- カード情報はStripeが管理
- アプリには`payment_method_id`のみ保存
- 実際のカード番号は保存しない

---

## 📝 バックエンドログ例

### 成功時

```
🔵 与信確保開始: { 
  amount: 1500, 
  customerId: 'cus_xxx', 
  auctionId: 'auction_xxx',
  userId: 'user_xxx'
}
🔵 前回の与信をキャンセル: pi_previous
✅ 前回の与信キャンセル成功
🔵 Payment Intent作成: { amount: 1500, currency: 'jpy' }
✅ Payment Intent作成成功: {
  id: 'pi_new',
  status: 'requires_capture',
  amount: 1500
}
```

### エラー時

```
🔵 与信確保開始: { ... }
❌ 与信確保エラー: Your card has insufficient funds.
```

---

## 🎊 実装完了チェックリスト

- [x] 入札時にPaymentIntent（手動キャプチャ）で与信確保
- [x] カードの利用可能額内であることを自動確認
- [x] 前回入札者の与信を自動キャンセル
- [x] エラーハンドリング強化
- [x] 詳細ログ追加
- [x] ローカル環境でテスト成功
- [x] Heroku環境変数設定済み

---

## 🚀 次のステップ（オプション）

### Phase 1: リアルタイム更新
- Supabase Realtimeで入札状況を同期
- 他のユーザーの入札をリアルタイム表示

### Phase 2: オークション終了処理
- Supabase Edge Functionsでスケジュール実行
- 落札者の決済を自動確定
- 他の入札者の与信を一括キャンセル

### Phase 3: 通知機能
- 入札された時にインフルエンサーに通知
- 落札した時にファンに通知
- オークション終了前の通知

---

完璧に動作しています！🎉

