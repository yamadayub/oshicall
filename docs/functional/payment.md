# 決済・カード登録機能

## 対応する業務仕様

- [/docs/business/payment.md](../business/payment.md)

## 概要
Stripe APIを使用した安全な決済処理。与信確保（Authorization）と決済確定（Capture）の2段階決済を実装。

## 決済フロー概要

### シンプルな決済フロー（従来）
```
入札時: Authorization（与信確保）
  ↓
オークション終了
  ↓
落札者: 即座にCapture（決済確定）
落札できなかった人: Cancel（与信解放）
```

### 高度な決済フロー（**現在の実装** - Webhook活用）
```
入札時: Authorization（与信確保）
  ↓
オークション終了
  ↓
purchased_slots作成（status='pending'、決済は保留）
  ↓
Talk実施（ビデオ通話）
  ↓
Daily.co Webhook受信（イベントログ記録）
  ↓
Talk完了判定（インフルエンサー参加・規定時間完了・途中退出なし）
  ↓
┌─────────┴─────────┐
│                   │
条件を満たす      条件を満たさない
│                   │
Capture            Cancel
（決済確定）        （与信解放）
│                   │
status='completed'  status='cancelled'
```

**詳細な仕様と実装コードについては、[高度な決済フロー詳細 (ADVANCED_PAYMENT_FLOW.md)](../ADVANCED_PAYMENT_FLOW.md) を参照してください。**

## 機能詳細

### 1. Stripe顧客作成
**実装ファイル**: `backend/src/server.ts` (`POST /api/stripe/create-customer`)

**タイミング**: 初回カード登録時

**処理フロー**:
1. Supabaseからユーザー情報取得
2. Stripe顧客作成
3. `users`テーブルに`stripe_customer_id`保存

**リクエスト**:
```json
{
  "userId": "user_uuid",
  "email": "user@example.com",
  "name": "User Name"
}
```

### 2. カード情報登録
**実装ファイル**:
- フロント: `src/components/CardRegistrationModal.tsx`
- バックエンド: `backend/src/server.ts`

**使用技術**: Stripe Elements (Stripe公式UIコンポーネント)

**処理フロー**:
1. Stripe Elements でカード情報入力
2. `PaymentMethod` 作成（フロント）
3. バックエンドに `paymentMethodId` 送信
4. Stripe顧客にカード紐付け
5. デフォルト支払い方法として設定
6. Supabaseの`has_payment_method`を`true`に更新

**API エンドポイント**: `POST /api/stripe/attach-payment-method` (注: 実装では `confirm-payment-method` 等の名称の場合あり)

### 3. 与信確保（Authorization）
**実装ファイル**: `backend/src/server.ts` (`POST /api/stripe/authorize-payment`)

**タイミング**: 入札時または即決購入時

**処理フロー**:
1. PaymentIntent作成
2. `capture_method: 'manual'` 指定（自動決済を防ぐ）
3. 顧客のデフォルト支払い方法使用
4. `paymentIntentId`を返却
5. `bids`テーブルに保存

**与信確保の意味**:
- カードの有効性確認
- 利用可能額の確認
- 金額を一時的に「保留」（実際の引き落としはまだ）
- 最大7日間保持可能

### 4. 決済確定（Capture）
**実装ファイル**:
- `backend/src/server.ts` (`POST /api/stripe/capture-payment`)
- `backend/src/services/paymentCapture.ts` (ロジック本体)

**タイミング**:
- Talk正常完了時（Webhook経由）
- 即決購入時（即座に）

**処理フロー**:
1. `paymentIntentId`を取得
2. Stripe Capture API呼び出し
3. 決済完了
4. `purchased_slots`の`stripe_payment_intent_id`更新

### 5. 与信解放（Cancel）
**実装ファイル**:
- `backend/src/server.ts` (`POST /api/stripe/cancel-payment` または `cancel-authorization`)

**タイミング**:
- オークション終了時（落札できなかった入札者）
- Talk不成立時（インフルエンサー不在など）

**処理フロー**:
1. 対象の`paymentIntentId`を取得
2. Stripe Cancel API呼び出し
3. 与信解放（保留金額解除）

### 6. オークション終了時の決済処理（現在の実装）
**実装ファイル**: `backend/src/server.ts` (`POST /api/auctions/finalize-ended`)

**重要な変更:** オークション終了時には**決済を確定せず**、Talk完了後にDaily.co Webhookで判定します。

**詳細:** [ADVANCED_PAYMENT_FLOW.md](../ADVANCED_PAYMENT_FLOW.md) を参照。

### 7. Talk完了後の決済判定と確定（Webhook活用）

#### 7.1 Daily.co Webhookイベント受信
**実装ファイル**: `backend/src/routes/dailyWebhook.ts`

#### 7.2 Talk完了判定ロジック
**実装ファイル**: `backend/src/services/paymentCapture.ts`

**判定条件（すべて満たす必要あり）:**
1. **インフルエンサーが参加した**
2. **ルームが「規定時間経過による自動終了」になった**
3. **インフルエンサーが途中退出していない**

#### 7.3 決済確定または与信キャンセル
**実装ファイル**: `backend/src/services/paymentCapture.ts`

**ケースA: すべての条件を満たした → 決済確定**
- Payment Intentをcapture
- `call_status: 'completed'`

**ケースB: 条件を満たさない → 与信キャンセル**
- Payment Intentをキャンセル
- `call_status: 'cancelled'`
- ファンのカードへの与信が解放され、課金されない

**詳細:** [ADVANCED_PAYMENT_FLOW.md](../ADVANCED_PAYMENT_FLOW.md) を参照。

## データ構造

### users テーブル（決済関連フィールド）
```sql
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN has_payment_method BOOLEAN DEFAULT FALSE;
```

### bids テーブル（決済関連フィールド）
```sql
CREATE TABLE bids (
  ...
  stripe_payment_intent_id TEXT NOT NULL,
  ...
);
```

### purchased_slots テーブル（決済関連フィールド）
```sql
CREATE TABLE purchased_slots (
  ...
  stripe_payment_intent_id TEXT,
  final_price INTEGER NOT NULL,
  purchase_type TEXT NOT NULL, -- 'auction' or 'buy_now'
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  ...
);
```

## UI/UX

### カード登録モーダル
**コンポーネント**: `src/components/CardRegistrationModal.tsx`

**表示内容**:
- Stripe Elements (カード番号、有効期限、CVC入力)
- 登録ボタン
- キャンセルボタン
- セキュリティ説明（「カード情報は安全に保護されます」）

### 支払いタイミングの説明
各入札画面に表示:
```
💡 お支払いのタイミング
入札時点では料金は発生しません。
オークション終了後、最高入札者として落札した場合のみ、
登録済みのカードから自動決済されます。
```

## エラーハンドリング

### カード登録エラー
- カード番号不正: `カード番号が正しくありません`
- 有効期限切れ: `カードの有効期限が切れています`
- CVC不正: `セキュリティコードが正しくありません`
- ネットワークエラー: `通信エラーが発生しました。再度お試しください`

### 与信確保エラー
- 利用限度額超過: `カードの利用限度額を超えています`
- カード無効: `カードが無効です。別のカードをお試しください`
- 3Dセキュア必要: 認証画面表示

### 決済確定エラー
- タイムアウト: 自動リトライ（最大3回）
- PaymentIntent不正: エラーログ記録、管理者通知

## セキュリティ

### PCI DSS準拠
- カード情報を自社サーバーに保存しない
- Stripe Elements使用（カード情報はStripe経由で送信）
- トークン化されたpaymentMethodIdのみ扱う

### HTTPS通信
- 全ての決済関連通信はHTTPSのみ
- 本番環境でHTTP通信を禁止

### APIキー管理
- Stripe Secret Keyは環境変数で管理
- バージョン管理システムにコミットしない
- Heroku Config Varsで設定

### エラーログ
- 決済エラーは全てログ記録
- 個人情報（カード番号等）はログに含めない
- Stripe Dashboard で決済履歴確認可能

## テスト

### テストカード番号
**成功**:
- `4242 4242 4242 4242` - Visa

**失敗パターン**:
- `4000 0000 0000 0002` - カード拒否
- `4000 0000 0000 9995` - 残高不足

### テスト環境
- Stripeテストモード使用
- 本番のカード情報は使用しない
- Test APIキーで実行
