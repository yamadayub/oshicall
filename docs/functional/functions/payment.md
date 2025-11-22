# 決済・カード登録機能 要件定義

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

**詳細:** [高度な決済フロー（ADVANCED_PAYMENT_FLOW.md）](../ADVANCED_PAYMENT_FLOW.md)を参照してください。

## 機能詳細

### 1. Stripe顧客作成
**実装ファイル**: `backend/src/routes/stripe.ts` (`POST /api/stripe/create-customer`)

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

**レスポンス**:
```json
{
  "customerId": "cus_xxxxx"
}
```

**Stripe API**:
```typescript
const customer = await stripe.customers.create({
  email: email,
  name: name,
  metadata: { supabase_user_id: userId }
});
```

### 2. カード情報登録
**実装ファイル**:
- フロント: `src/components/CardRegistrationModal.tsx`
- バックエンド: `backend/src/routes/stripe.ts`

**使用技術**: Stripe Elements (Stripe公式UIコンポーネント)

**処理フロー**:
1. Stripe Elements でカード情報入力
2. `PaymentMethod` 作成（フロント）
3. バックエンドに `paymentMethodId` 送信
4. Stripe顧客にカード紐付け
5. デフォルト支払い方法として設定
6. Supabaseの`has_payment_method`を`true`に更新

**API エンドポイント**: `POST /api/stripe/attach-payment-method`

**リクエスト**:
```json
{
  "customerId": "cus_xxxxx",
  "paymentMethodId": "pm_xxxxx",
  "userId": "user_uuid"
}
```

**レスポンス**:
```json
{
  "success": true
}
```

**Stripe API**:
```typescript
// PaymentMethodを顧客に紐付け
await stripe.paymentMethods.attach(paymentMethodId, {
  customer: customerId
});

// デフォルト支払い方法として設定
await stripe.customers.update(customerId, {
  invoice_settings: {
    default_payment_method: paymentMethodId
  }
});
```

### 3. 与信確保（Authorization）
**実装ファイル**: `backend/src/routes/stripe.ts` (`POST /api/stripe/authorize-payment`)

**タイミング**: 入札時または即決購入時

**処理フロー**:
1. PaymentIntent作成
2. `capture_method: 'manual'` 指定（自動決済を防ぐ）
3. 顧客のデフォルト支払い方法使用
4. `paymentIntentId`を返却
5. `bids`テーブルに保存

**リクエスト**:
```json
{
  "amount": 5000,
  "customerId": "cus_xxxxx",
  "auctionId": "auction_uuid",
  "userId": "user_uuid"
}
```

**レスポンス**:
```json
{
  "paymentIntentId": "pi_xxxxx"
}
```

**Stripe API**:
```typescript
const paymentIntent = await stripe.paymentIntents.create({
  amount: amount,
  currency: 'jpy',
  customer: customerId,
  capture_method: 'manual', // 重要: 自動決済しない
  payment_method_types: ['card'],
  metadata: {
    auction_id: auctionId,
    user_id: userId
  }
});
```

**与信確保の意味**:
- カードの有効性確認
- 利用可能額の確認
- 金額を一時的に「保留」（実際の引き落としはまだ）
- 最大7日間保持可能

### 4. 決済確定（Capture）
**実装ファイル**:
- `backend/src/routes/stripe.ts` (`POST /api/stripe/capture-payment`)
- `supabase/functions/end-auction/index.ts`

**タイミング**:
- オークション終了時（落札者のみ）
- 即決購入時（即座に）

**処理フロー**:
1. `paymentIntentId`を取得
2. Stripe Capture API呼び出し
3. 決済完了
4. `purchased_slots`の`stripe_payment_intent_id`更新

**API エンドポイント**: `POST /api/stripe/capture-payment`

**リクエスト**:
```json
{
  "paymentIntentId": "pi_xxxxx"
}
```

**レスポンス**:
```json
{
  "success": true,
  "amount": 5000
}
```

**Stripe API**:
```typescript
const paymentIntent = await stripe.paymentIntents.capture(
  paymentIntentId
);
```

### 5. 与信解放（Cancel）
**実装ファイル**:
- `backend/src/routes/stripe.ts` (`POST /api/stripe/cancel-payment`)
- `supabase/functions/end-auction/index.ts`

**タイミング**: オークション終了時（落札できなかった入札者）

**処理フロー**:
1. 落札できなかった入札の`paymentIntentId`を取得
2. Stripe Cancel API呼び出し
3. 与信解放（保留金額解除）

**API エンドポイント**: `POST /api/stripe/cancel-payment`

**リクエスト**:
```json
{
  "paymentIntentId": "pi_xxxxx"
}
```

**レスポンス**:
```json
{
  "success": true
}
```

**Stripe API**:
```typescript
const paymentIntent = await stripe.paymentIntents.cancel(
  paymentIntentId
);
```

### 6. オークション終了時の決済処理（現在の実装）
**実装ファイル**: `backend/src/server.ts` (`POST /api/auctions/finalize-ended`)

**トリガー**: 外部Cronサービス（1分ごと）

**重要な変更:** オークション終了時には**決済を確定せず**、Talk完了後にDaily.co Webhookで判定します。

**処理フロー**:
```typescript
// 1. 終了したオークションを取得
const { data: endedAuctions } = await supabase
  .from('active_auctions_view')
  .select('*')
  .eq('status', 'active')
  .lte('end_time', now);

for (const auction of endedAuctions) {
  // 2. 最高入札を取得
  const { data: highestBid } = await supabase
    .from('bids')
    .select('*')
    .eq('auction_id', auction.auction_id)
    .order('bid_amount', { ascending: false })
    .limit(1)
    .single();

  if (highestBid) {
    // 3. プラットフォーム手数料計算（20%）
    const platformFee = Math.round(highestBid.bid_amount * 0.2);
    const influencerPayout = highestBid.bid_amount - platformFee;

    // 4. purchased_slots作成（決済は保留！）
    await supabase.from('purchased_slots').insert({
      call_slot_id: auction.call_slot_id,
      fan_user_id: highestBid.user_id,
      influencer_user_id: auction.influencer_id,
      auction_id: auction.auction_id,
      winning_bid_amount: highestBid.bid_amount,
      platform_fee: platformFee,
      influencer_payout: influencerPayout,
      call_status: 'pending', // ← Talk完了後に決済
    });

    // 5. オークション終了
    await supabase
      .from('auctions')
      .update({ status: 'ended', winner_user_id: highestBid.user_id })
      .eq('id', auction.auction_id);

    // 6. 他の入札者の与信解放（これは即座に実行）
    const { data: otherBids } = await supabase
      .from('bids')
      .select('stripe_payment_intent_id')
      .eq('auction_id', auction.auction_id)
      .neq('user_id', highestBid.user_id);

    for (const bid of otherBids) {
      await stripe.paymentIntents.cancel(bid.stripe_payment_intent_id);
    }
  }
}
```

**重要:**
- 落札者の`stripe_payment_intent_id`は`authorized`状態のまま保持
- 決済確定（capture）はTalk完了後にDaily.co Webhookで実行

**実装ファイル:** `backend/src/server.ts:1050-1177`

### 7. Talk完了後の決済判定と確定（Webhook活用）

#### 7.1 Daily.co Webhookイベント受信
**実装ファイル**: `backend/src/routes/dailyWebhook.ts`

**受信イベント**:
- `participant.joined` - 参加者入室
- `participant.left` - 参加者退室
- `room.ended` - ルーム終了
- `meeting.ended` - ミーティング終了

**処理フロー**:
```typescript
// 1. Webhookイベント受信
router.post('/webhook', async (req, res) => {
  const event = req.body;

  // 2. イベントログをDBに保存
  await supabase.from('daily_call_events').insert({
    purchased_slot_id: purchasedSlot.id,
    event_type: event.type,
    user_id: event.participant?.user_id,
    room_end_reason: event.end_reason || (event.expired_at ? 'duration' : 'manual'),
    event_data: event,
  });

  // 3. room.ended イベントの場合、決済処理をトリガー
  if (event.type === 'room.ended' || event.type === 'meeting.ended') {
    processTalkPayment(supabase, purchasedSlot.id);
  }

  res.status(200).json({ received: true });
});
```

**実装ファイル:** `backend/src/routes/dailyWebhook.ts:12-110`

#### 7.2 Talk完了判定ロジック
**実装ファイル**: `backend/src/services/paymentCapture.ts`

**判定条件（すべて満たす必要あり）:**

1. **インフルエンサーが参加した**
```typescript
const influencerJoined = events.some((e) =>
  (e.event_type === 'participant.joined') &&
  (e.user_id === purchasedSlot.influencer_user_id)
);
```

2. **ルームが「規定時間経過による自動終了」になった**
```typescript
const roomEndedByDuration = events.some((e) =>
  (e.event_type === 'room.ended' || e.event_type === 'meeting.ended') &&
  (e.room_end_reason === 'duration')
);
```

3. **インフルエンサーが途中退出していない**
```typescript
function hasInfluencerLeftBeforeRoomEnd(events, influencerUserId) {
  const roomEndEvent = events.find(e =>
    e.event_type === 'room.ended' || e.event_type === 'meeting.ended'
  );
  const influencerLeftEvent = events.find(e =>
    e.event_type === 'participant.left' && e.user_id === influencerUserId
  );

  if (!influencerLeftEvent) return false; // 最後までいた

  const roomEndTime = new Date(roomEndEvent.created_at);
  const leftTime = new Date(influencerLeftEvent.created_at);

  return leftTime < roomEndTime; // 終了前に退出したらtrue
}
```

**実装ファイル:** `backend/src/services/paymentCapture.ts:25-182`

#### 7.3 決済確定または与信キャンセル
**実装ファイル**: `backend/src/services/paymentCapture.ts`

**ケースA: すべての条件を満たした → 決済確定**
```typescript
// 1. Payment Intentをcapture
const capturedPayment = await stripe.paymentIntents.capture(paymentIntentId);

// 2. payment_transactionsに記録
await supabase.from('payment_transactions').insert({
  purchased_slot_id: purchasedSlotId,
  stripe_payment_intent_id: capturedPayment.id,
  amount: bidAmount,
  platform_fee: platformFee,
  influencer_payout: influencerPayout,
  status: 'captured',
});

// 3. purchased_slotsのステータス更新
await supabase.from('purchased_slots').update({
  call_status: 'completed',
}).eq('id', purchasedSlotId);
```

**ケースB: 条件を満たさない → 与信キャンセル**
```typescript
// 1. Payment Intentをキャンセル
await stripe.paymentIntents.cancel(paymentIntentId);

// 2. purchased_slotsのステータス更新
await supabase.from('purchased_slots').update({
  call_status: 'cancelled',
}).eq('id', purchasedSlotId);

// ファンのカードへの与信が解放され、課金されない
```

**実装ファイル:** `backend/src/services/paymentCapture.ts:193-306`

**メリット:**
- ✅ インフルエンサーno-show時に課金されない
- ✅ 途中退出時に課金されない
- ✅ 規定時間前終了時に課金されない
- ✅ より公平で信頼できるプラットフォーム

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

**表示タイミング**:
- 未登録ユーザーが入札しようとした時
- マイページから手動登録

### 支払いタイミングの説明
各入札画面に表示:
```
💡 お支払いのタイミング
入札時点では料金は発生しません。
オークション終了後、最高入札者として落札した場合のみ、
登録済みのカードから自動決済されます。
```

### カード情報表示
- マイページに登録済みカード表示
- 末尾4桁のみ表示（例: •••• 4242）
- カードブランド表示（Visa, Mastercard等）

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

**有効期限**: 未来の日付（例: 12/34）
**CVC**: 任意の3桁（例: 123）

### テスト環境
- Stripeテストモード使用
- 本番のカード情報は使用しない
- Test APIキーで実行

## パフォーマンス

### 非同期処理
- 与信解放は非同期で実行
- オークション終了処理はバックグラウンドジョブ

### リトライロジック
- 決済確定失敗時は自動リトライ（指数バックオフ）
- 最大3回まで

### タイムアウト
- Stripe API呼び出しタイムアウト: 30秒
- 超過時はエラーハンドリング

## 監視・運用

### ログ
- 全ての決済処理をログ記録
- エラー発生時は詳細ログ
- Stripe Webhook イベントログ

### アラート
- 決済失敗率が閾値超過時に通知
- 与信解放失敗時に通知

### Stripe Dashboard
- 決済履歴確認
- 返金処理
- 顧客管理
