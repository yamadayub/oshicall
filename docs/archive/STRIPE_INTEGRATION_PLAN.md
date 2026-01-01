# Stripe 決済連携 実装計画

## 📋 全体フロー

```
1. ユーザー登録 → 2. カード登録 → 3. 入札 → 4. 与信確保 → 5. オークション終了 → 6. 決済確定
```

## 🎯 フェーズ 1: Stripe 環境設定とカード登録 UI

### ステップ 1-1: Stripe API キーの設定

**必要な作業:**

- [ ] Stripe Dashboard で以下を取得:
  - Publishable key (pk_test_xxx または pk_live_xxx)
  - Secret key (sk_test_xxx または sk_live_xxx)
- [ ] 環境変数を設定:
  - フロントエンド: `VITE_STRIPE_PUBLISHABLE_KEY`
  - バックエンド: `STRIPE_SECRET_KEY`

**URL:**

- https://dashboard.stripe.com/test/apikeys

### ステップ 1-2: バックエンド API 構築

**必要なエンドポイント:**

```
POST /api/stripe/create-customer       - Stripe顧客作成
POST /api/stripe/create-setup-intent   - カード登録用Intent作成
POST /api/stripe/confirm-payment-method - カード登録確認
POST /api/stripe/create-payment-intent - 与信確保
POST /api/stripe/cancel-payment-intent - 与信キャンセル
POST /api/stripe/capture-payment       - 決済確定
```

**実装場所:**

- `backend/src/routes/stripe.ts`
- `backend/src/services/stripe.ts`

### ステップ 1-3: カード登録 UI コンポーネント

**作成するファイル:**

- `src/components/CardRegistrationModal.tsx`
- `src/lib/stripe.ts` (Stripe.js 初期化)

**機能:**

- カード情報入力フォーム
- Stripe Elements 統合
- Setup Intent 処理
- エラーハンドリング

---

## 🎯 フェーズ 2: 入札フロー実装

### ステップ 2-1: 入札前チェック

**チェック項目:**

1. ユーザーがログインしているか
2. カードが登録されているか (`users.has_payment_method`)
3. オークションが active 状態か
4. 入札額が現在の最高額+最小単位以上か

### ステップ 2-2: 与信確保

**処理:**

1. Payment Intent を作成（status: requires_capture）
2. 金額をホールド（実際には請求しない）
3. payment_intent_id を保存

### ステップ 2-3: 入札データ保存

**DB テーブル:**

- `bids` テーブルに保存
- `auctions` テーブルを更新（最高入札額、入札者）

**RPC 関数使用:**

```sql
SELECT update_auction_highest_bid(auction_id, bid_amount, user_id);
```

---

## 🎯 フェーズ 3: 入札管理とオークション終了

### ステップ 3-1: 入札が上書きされた場合

**処理:**

1. 前の入札者の与信をキャンセル
2. 新しい入札者の与信を確保

### ステップ 3-2: オークション終了処理

**自動処理（Supabase Edge Functions または Cron）:**

1. オークション終了時刻を監視
2. 最高入札者の与信を決済確定（capture）
3. `purchased_slots` テーブルに記録
4. 他の入札者の与信をキャンセル

### ステップ 3-3: 決済失敗時の処理

**フォールバック:**

1. 次点の入札者に切り替え
2. 与信確保を試行
3. 成功するまで繰り返し

---

## 🎯 フェーズ 4: リアルタイム更新

### ステップ 4-1: Supabase Realtime 設定

**監視するテーブル:**

- `auctions` テーブルの変更
- `bids` テーブルの新規追加

### ステップ 4-2: フロントエンド実装

**リアルタイム同期:**

```typescript
supabase
  .channel("auction-updates")
  .on(
    "postgres_changes",
    { event: "UPDATE", schema: "public", table: "auctions" },
    (payload) => {
      // 最高入札額を更新
    }
  )
  .subscribe();
```

---

## 🔐 セキュリティ考慮事項

### 1. RLS ポリシー

- ✅ ユーザーは自分の入札のみ表示可能
- ✅ 与信情報は保護

### 2. バックエンド検証

- ✅ 入札額の妥当性チェック
- ✅ 重複入札の防止
- ✅ Stripe Webhook で決済状態を同期

### 3. エラーハンドリング

- ✅ カード登録失敗
- ✅ 与信失敗
- ✅ 決済失敗

---

## 💰 料金設定

### プラットフォーム手数料: 20%

**例:**

- 入札額: ¥10,000
- プラットフォーム手数料: ¥2,000 (20%)
- インフルエンサー受取: ¥8,000 (80%)

**Stripe 手数料:**

- 国内カード: 3.6%
- 実際のコスト例: ¥10,000 × 3.6% = ¥360

---

## 📊 データベーススキーマ（確認）

### bids テーブル

```sql
- id (UUID)
- auction_id (UUID)
- user_id (UUID)
- bid_amount (DECIMAL)
- stripe_payment_intent_id (VARCHAR) -- 与信ID
- is_autobid (BOOLEAN)
- created_at (TIMESTAMP)
```

### payment_transactions テーブル

```sql
- id (UUID)
- purchased_slot_id (UUID)
- stripe_payment_intent_id (VARCHAR)
- stripe_charge_id (VARCHAR)
- amount (DECIMAL)
- platform_fee (DECIMAL)
- influencer_payout (DECIMAL)
- status (payment_status)
- created_at (TIMESTAMP)
```

---

## 🎯 次のアクション

今から**フェーズ 1: ステップ 1-1**を開始します。

Stripe Dashboard で以下を確認してください：

1. **Publishable key**を取得

   - Dashboard → Developers → API keys
   - 「Publishable key」をコピー

2. **Secret key**を取得
   - 「Secret key」を「Reveal」してコピー
   - ⚠️ このキーは絶対に公開しないでください

準備ができたら、次のステップに進みます！
