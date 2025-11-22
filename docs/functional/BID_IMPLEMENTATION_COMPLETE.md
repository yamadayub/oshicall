# 入札機能実装 完了ガイド

## ✅ 実装完了内容

### 1. **入札チェック機能**
- ✅ ユーザーログインチェック
- ✅ カード登録チェック
- ✅ 与信確保処理
- ✅ エラーハンドリング

### 2. **統合されたフロー**
```
入札ボタンクリック
  ↓
①ログインチェック → 未ログイン → AuthModal表示
  ↓
②カード登録チェック → 未登録 → CardRegistrationModal表示
  ↓
③与信確保 → 成功/失敗
  ↓
④入札データ保存 → Supabase
  ↓
⑤UI更新 → 成功メッセージ
```

### 3. **実装ファイル**

#### フロントエンド
- ✅ `src/pages/TalkDetail.tsx` - 入札ボタンに3段階チェック追加
- ✅ `src/components/AuthModal.tsx` - `onSuccess`コールバック追加
- ✅ `src/components/CardRegistrationModal.tsx` - カード登録UI
- ✅ `src/api/stripe.ts` - Stripe API呼び出し（既存）

#### バックエンド
- ✅ `backend/src/server.ts` - Supabase対応に更新済み
  - `/api/stripe/create-customer` - Stripe顧客作成
  - `/api/stripe/create-setup-intent` - カード登録用
  - `/api/stripe/set-default-payment-method` - デフォルト設定
  - `/api/stripe/confirm-payment-method` - 登録確認
  - `/api/stripe/authorize-payment` - 与信確保（入札時）

---

## 🚀 セットアップ手順

### ステップ1: Stripe APIキーの取得

1. https://dashboard.stripe.com/test/apikeys にアクセス
2. 以下をコピー:
   - **Publishable key**: `pk_test_xxx`
   - **Secret key**: `sk_test_xxx`

### ステップ2: フロントエンド環境変数

`.env` ファイルに追加：

```bash
# 既存
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...

# 追加
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
VITE_BACKEND_URL=http://localhost:3001
```

### ステップ3: バックエンド環境変数

`backend/.env` ファイルを作成（`.env.example`をコピー）：

```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Supabase (Service Role Key)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...service_role_key

# Frontend
FRONTEND_URL=http://localhost:5173

# Port
PORT=3001
```

**Service Role Keyの取得:**
```
Supabase Dashboard → Settings → API → service_role key (Reveal)
```

### ステップ4: バックエンド起動

```bash
cd backend
npm install
npm run dev
```

期待される出力：
```
🚀 Server running on port 3001
```

### ステップ5: フロントエンド起動

```bash
# プロジェクトルートで
npm run dev
```

---

## 🧪 テスト手順

### 1. **未ログイン状態で入札**

```
1. http://localhost:5173/ を開く
2. Talk枠をクリック
3. 入札ボタン（+¥10, +¥100, +¥1000）をクリック
4. ✅ AuthModalが表示される
5. ログイン or サインアップ
6. ✅ 自動的にCardRegistrationModalに遷移
```

### 2. **カード未登録状態で入札**

```
1. ログイン済みで Talk Detail ページを開く
2. 入札ボタンをクリック
3. ✅ CardRegistrationModalが表示される
```

### 3. **カード登録**

```
1. CardRegistrationModal で以下を入力:
   - カード番号: 4242 4242 4242 4242 (テストカード)
   - 有効期限: 12/34 (任意の未来日付)
   - CVC: 123 (任意の3桁)
   - ZIP: 123-4567
2. 「カードを登録」をクリック
3. ✅ カード登録成功
4. ✅ 自動的に保留していた入札が実行される
```

### 4. **正常な入札**

```
1. ログイン済み & カード登録済み
2. Talk Detail ページで入札ボタンをクリック
3. ✅ 与信確保が実行される
4. ✅ 入札データがSupabaseに保存される
5. ✅ 「✅ ¥xxx で入札しました！」メッセージ
6. ✅ 最高入札額が更新される
```

### 5. **与信失敗のテスト**

Stripeのテストカードで失敗させる：

```
カード番号: 4000 0000 0000 0002 (カード拒否)
↓
✅ 「入札に失敗しました: カードが拒否されました」エラー表示
```

---

## 📊 動作フロー詳細

### フロー1: 未ログイン→カード登録→入札

```typescript
// 1. 入札ボタンクリック
handleBid(10)
  ↓
// 2. ログインチェック（未ログイン）
if (!user) {
  setPendingBidAmount(currentHighestBid + 10)
  setShowAuthModal(true)
  return
}
  ↓
// 3. ログイン成功
handleAuthSuccess()
  ↓
// 4. カード登録モーダル表示
setShowCardModal(true)
  ↓
// 5. カード登録成功
handleCardRegistrationSuccess()
  ↓
// 6. 保留していた入札を実行
processBid(pendingBidAmount)
  ↓
// 7. 与信確保API呼び出し
POST /api/stripe/authorize-payment
  ↓
// 8. 入札データ保存
INSERT INTO bids (auction_id, user_id, bid_amount, stripe_payment_intent_id)
  ↓
// 9. 成功メッセージ
alert('✅ ¥xxx で入札しました！')
```

### フロー2: ログイン済み→カード未登録→入札

```typescript
// 1. 入札ボタンクリック
handleBid(100)
  ↓
// 2. ログインチェック（済み）→ PASS
  ↓
// 3. カード登録チェック（未登録）
if (!supabaseUser.has_payment_method) {
  setPendingBidAmount(currentHighestBid + 100)
  setShowCardModal(true)
  return
}
  ↓
// 4. カード登録成功後、保留していた入札を実行
handleCardRegistrationSuccess() → processBid(pendingBidAmount)
```

### フロー3: すべて準備済み→入札

```typescript
// 1. 入札ボタンクリック
handleBid(1000)
  ↓
// 2. ログインチェック（済み）→ PASS
// 3. カード登録チェック（済み）→ PASS
  ↓
// 4. 直接入札処理
processBid(currentHighestBid + 1000)
  ↓
// 5. 与信確保 & データ保存 & UI更新
```

---

## 🔐 セキュリティ考慮事項

### 1. **与信のみ、決済は未確定**
```
入札時: Payment Intent作成 (capture_method: 'manual')
↓
オークション終了後: Payment Intent キャプチャ（手動）
```

### 2. **RLSポリシー確認**
```sql
-- bidsテーブル
CREATE POLICY "Users can view their own bids"
  ON bids FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bids"
  ON bids FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### 3. **与信情報の保護**
- `stripe_payment_intent_id` はバックエンドのみ管理
- フロントエンドには送信しない

---

## 🐛 トラブルシューティング

### エラー1: `VITE_BACKEND_URL is not defined`

**原因**: 環境変数が設定されていない

**解決策**:
```bash
# .envに追加
VITE_BACKEND_URL=http://localhost:3001

# 再起動
npm run dev
```

### エラー2: `stripe_customer_id is null`

**原因**: Stripe顧客が作成されていない

**解決策**:
バックエンドの `/api/stripe/create-customer` エンドポイントが正しく動作しているか確認。

### エラー3: `payment method not found`

**原因**: カード登録が完了していない

**解決策**:
1. CardRegistrationModal でカードを再登録
2. `users.has_payment_method` が `true` になっているか確認

---

## 🎉 次のステップ

### 完了した機能
- ✅ 入札ボタンの3段階チェック
- ✅ ログインフロー統合
- ✅ カード登録フロー
- ✅ 与信確保
- ✅ 入札データ保存

### 今後実装する機能
1. **オークション終了処理**
   - スケジューラーで自動実行
   - 最高入札者の与信を決済確定
   - 他の入札者の与信をキャンセル

2. **リアルタイム更新**
   - Supabase Realtime で入札状況を同期
   - 他のユーザーの入札をリアルタイム表示

3. **入札履歴ページ**
   - 自分の入札一覧
   - 現在の順位表示

4. **自動入札機能**
   - 最高入札額+1を自動入札
   - 上限額設定

---

## 📚 関連ドキュメント

- `STRIPE_INTEGRATION_PLAN.md` - 全体計画
- `STRIPE_SETUP_STEP_BY_STEP.md` - セットアップガイド
- `URL_ROUTING.md` - URLルーティング

---

すべて実装完了しました！🎊

バックエンドを起動して、ブラウザでテストしてください。

