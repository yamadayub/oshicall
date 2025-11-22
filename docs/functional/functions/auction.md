# オークション機能 要件定義

## 概要
Talk枠をオークション形式で販売する機能。リアルタイム入札と即決購入の2つの方式をサポート。

## 機能詳細

### 1. オークション作成
**実装ファイル**: `backend/src/routes/auctions.ts`, `src/components/CreateCallSlotForm.tsx`

**入力項目**:
- `call_slot_id` - 対象のTalk枠ID
- `starting_price` - 開始価格（最低入札価格）
- `minimum_bid_increment` - 最小入札単位（デフォルト: 100円）
- `buy_now_price` - 即決価格（任意）
- `start_time` - オークション開始時刻
- `end_time` - オークション終了時刻

**バリデーション**:
- 開始価格 > 0
- 即決価格がある場合、即決価格 > 開始価格
- 終了時刻 > 開始時刻
- 終了時刻 > 現在時刻

**DB操作**:
```sql
INSERT INTO auctions (
  call_slot_id, starting_price, minimum_bid_increment,
  buy_now_price, start_time, end_time, status
) VALUES (...);
```

### 2. 通常入札
**実装ファイル**: `src/pages/TalkDetail.tsx` (handleBid関数)

**フロー**:
1. ログインチェック → 未ログインなら認証モーダル表示
2. カード登録チェック → 未登録ならカード登録モーダル表示
3. Stripe与信確保（Authorization）
4. Supabaseに入札データ保存
5. オークション情報更新（最高入札額・入札者）

**入札条件**:
- 入札額 > 現在の最高入札額
- オークションステータスが`active`
- 与信確保が成功

**API エンドポイント**: `POST /api/stripe/authorize-payment`

**リクエスト**:
```json
{
  "amount": 5000,
  "customerId": "cus_xxx",
  "auctionId": "auction_id",
  "userId": "user_id"
}
```

**レスポンス**:
```json
{
  "paymentIntentId": "pi_xxx"
}
```

**DB操作**:
```sql
-- 入札履歴保存
INSERT INTO bids (
  auction_id, user_id, bid_amount,
  stripe_payment_intent_id, is_autobid
) VALUES (...);

-- オークション情報更新（RPCファンクション）
SELECT update_auction_highest_bid(
  p_auction_id, p_bid_amount, p_user_id
);
```

### 3. 即決購入（Buy Now）
**実装ファイル**: `src/pages/TalkDetail.tsx` (handleBuyNow関数)

**フロー**:
1. ログインチェック
2. カード登録チェック
3. 確認ダイアログ表示
4. Stripe与信確保
5. 即決購入API呼び出し
6. オークション即座に終了
7. 購入済みTalk枠作成

**API エンドポイント**: `POST /api/buy-now`

**リクエスト**:
```json
{
  "auctionId": "auction_id",
  "userId": "user_id",
  "buyNowPrice": 10000,
  "paymentIntentId": "pi_xxx"
}
```

**レスポンス**:
```json
{
  "success": true,
  "purchasedSlotId": "slot_id"
}
```

**バックエンド処理** (`backend/src/routes/buyNow.ts`):
1. トランザクション開始
2. オークションステータスを`ended`に更新
3. `purchased_slots`レコード作成
4. Stripe決済確定（Capture）
5. トランザクションコミット

### 4. リアルタイム更新（ポーリング）
**実装ファイル**: `src/pages/TalkDetail.tsx` (useEffect - ポーリング)

**更新間隔**: 3秒

**取得データ**:
```sql
SELECT current_highest_bid, current_winner_id, status
FROM auctions
WHERE id = $1;
```

**更新内容**:
- 最高入札額の表示更新
- 自分が最高入札者かの表示更新（"You"バッジ）
- オークション終了の検知

### 5. オークション終了処理
**トリガー**: `end_time` 到達時（Supabase Function: `end-auction`）

**処理内容**:
1. `status`を`ended`に更新
2. 最高入札者を`current_winner_id`に保存
3. `purchased_slots`レコード作成
4. Stripe決済確定（Capture）
5. 落札できなかった入札の与信解放

**実装ファイル**: `supabase/functions/end-auction/index.ts`

### 6. オークション終了後の画面表示
**実装ファイル**: `src/pages/TalkDetail.tsx` (オークション終了後の画面)

**表示パターン**:

#### a) 落札者の場合
```
🎉
おめでとうございます！
オークションに落札されました

[Talk予定を確認する] → /mypage?tab=talks
```

#### b) 入札者（非落札者）の場合
```
😢
残念！
このTalkは別の方が落札されました

[他の枠をチェックする] → /i/{influencer_id}
```

#### c) 閲覧者（非入札者）の場合
```
📭
オークション終了
このTalk枠のオークションは終了しました

[他のTalk枠を見る] → /
```

**状態判定ロジック**:
```typescript
// 落札者判定
const isWinner = current_winner_id === supabaseUser.id;

// 入札履歴チェック
const userBids = await supabase
  .from('bids')
  .select('id')
  .eq('auction_id', auctionId)
  .eq('user_id', userId);

const userHasBid = userBids.length > 0;
```

## データ構造

### auctions テーブル
```sql
CREATE TABLE auctions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_slot_id UUID NOT NULL REFERENCES call_slots(id),
  starting_price INTEGER NOT NULL,
  minimum_bid_increment INTEGER DEFAULT 100,
  buy_now_price INTEGER,
  current_highest_bid INTEGER,
  current_winner_id UUID REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'active',
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### bids テーブル
```sql
CREATE TABLE bids (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auction_id UUID NOT NULL REFERENCES auctions(id),
  user_id UUID NOT NULL REFERENCES users(id),
  bid_amount INTEGER NOT NULL,
  stripe_payment_intent_id TEXT NOT NULL,
  is_autobid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### active_auctions_view ビュー
Home画面でのオークション一覧表示用のビュー。

```sql
CREATE VIEW active_auctions_view AS
SELECT
  a.id AS auction_id,
  cs.id AS call_slot_id,
  cs.title,
  cs.description,
  cs.scheduled_start_time,
  cs.duration_minutes,
  a.starting_price,
  a.current_highest_bid,
  a.end_time AS auction_end_time,
  a.status,
  u.id AS influencer_id,
  u.display_name AS influencer_name,
  u.profile_image_url AS influencer_image,
  u.bio AS influencer_bio,
  u.total_calls_completed,
  u.average_rating,
  cs.thumbnail_url
FROM auctions a
JOIN call_slots cs ON a.call_slot_id = cs.id
JOIN users u ON cs.user_id = u.id
WHERE a.status = 'active';
```

## UI/UX

### 入札ボタン
- クイック入札: +10円, +100円, +1,000円
- カスタム入札: 自由入力（鉛筆アイコン）

### 最高入札額表示
- 自分が最高入札者の場合: 緑色背景 + "You"バッジ
- 他の人が最高入札者の場合: 白色背景

### カウントダウンタイマー
- オークション終了までの残り時間をリアルタイム表示
- 実装: `src/components/CountdownTimer.tsx`

### 支払いタイミングの説明
```
💡 お支払いのタイミング
入札時点では料金は発生しません。
オークション終了後、最高入札者として落札した場合のみ、
登録済みのカードから自動決済されます。
```

## エラーハンドリング

### 入札エラー
- カード未登録: カード登録モーダル表示
- 与信失敗: エラーメッセージ表示
- 金額不足: `入札額は現在の最高価格より高い金額を入力してください`
- オークション終了済み: 入札ボタン無効化

### 即決購入エラー
- 確認キャンセル: 処理中断
- 決済失敗: エラーメッセージ表示

## パフォーマンス最適化

### ポーリング最適化
- オークション終了検知後はポーリング停止
- 関数型setState使用で不要な再レンダリング防止

### データ取得最適化
- active_auctions_view でJOINを事前実行
- 必要なフィールドのみSELECT

## セキュリティ

### 入札の正当性チェック
- サーバーサイドで入札額検証
- ユーザー認証状態検証
- オークションステータス検証

### 決済セキュリティ
- Stripe Payment Intent使用
- 与信確保と決済確定の分離
- 失敗時の自動ロールバック
