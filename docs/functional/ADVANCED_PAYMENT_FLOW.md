# 高度な決済フロー（Webhook活用）

## 概要

OshiTalkでは、より公平で高度な決済システムを実装しています。オークション終了時に即座に決済を確定するのではなく、**Talk（通話）が実際に正常完了したことをDaily.co Webhookで確認してから決済を確定**します。

これにより、インフルエンサーがno-show（不参加）や途中退出した場合に、ファンに不当な課金が発生することを防ぎます。

## 決済フローの比較

### 従来の方式（シンプル）
```
オークション終了 → 即座に決済確定 → Talk実施
```

**問題点:**
- インフルエンサーが現れなくてもファンに課金される
- インフルエンサーが途中退出してもファンに全額課金される
- 返金処理が煩雑になる

### 新方式（高度・公平）
```
オークション終了 → 与信確保のみ → Talk実施 → 正常完了を確認 → 決済確定
                                        ↓
                                   完了しなかった場合
                                        ↓
                                   与信をキャンセル
```

**メリット:**
- インフルエンサーが参加しなかった場合、課金されない
- 規定時間前に終了した場合、課金されない
- インフルエンサーが途中退出した場合、課金されない
- 返金不要（最初から課金しない）

## 技術的な実装詳細

### 1. オークション終了処理（`/api/auctions/finalize-ended`）

**修正前:**
```typescript
// オークション終了時に即座に決済確定
const capturedPayment = await stripe.paymentIntents.capture(paymentIntentId);
await supabase.from('payment_transactions').insert({
  status: 'captured',
  // ...
});
```

**修正後:**
```typescript
// purchased_slotsを作成するが決済は保留
const { data: purchasedSlot } = await supabase
  .from('purchased_slots')
  .insert({
    call_slot_id: auction.call_slot_id,
    fan_user_id: highestBid.user_id,
    influencer_user_id: auction.influencer_id,
    auction_id: auction.auction_id,
    winning_bid_amount: highestBid.bid_amount,
    platform_fee: platformFee,
    influencer_payout: influencerPayout,
    call_status: 'pending', // ← Talk完了後に決済
  })
  .select()
  .single();

// Payment Intentはauthorized状態のまま保持（captureしない）
console.log('決済は保留: Talk完了後にWebhookで判定');
```

**実装ファイル:** `/backend/src/server.ts` (line 1100-1168)

### 2. 決済処理のトリガー（2つのパス）

#### パスA: Daily.co Webhook受信（`/api/daily/webhook`）

Daily.coから以下のイベントを受信:
- `participant.joined` - 参加者が入室
- `participant.left` - 参加者が退室
- `room.ended` - ルーム終了
- `meeting.ended` - ミーティング終了

```typescript
// room.ended イベント受信時
if (event.type === 'room.ended' || event.type === 'meeting.ended') {
  // イベントデータをDBに保存
  await supabase.from('daily_call_events').insert({
    purchased_slot_id: purchasedSlot.id,
    event_type: event.type,
    user_id: event.participant?.user_id,
    room_end_reason: event.end_reason || (event.expired_at ? 'duration' : 'manual'),
    event_data: event,
  });

  // 非同期で決済処理をトリガー（Webhookレスポンスは即座に返す）
  processTalkPayment(supabase, purchasedSlot.id).catch(error => {
    console.error('決済処理エラー:', error);
  });
}
```

**実装ファイル:** `/backend/src/routes/dailyWebhook.ts` (line 12-110)

#### パスB: 手動終了時（`/api/calls/end-call`）

ユーザーが手動で通話を終了した場合、Webhookを待たずに決済処理を実行:

```typescript
// /api/calls/end-call エンドポイント
router.post('/end-call', async (req: Request, res: Response) => {
  // ... 通話終了情報を記録 ...

  // 決済処理を実行（Webhookを待たない）
  const { processTalkPayment } = await import('../routes/dailyWebhook');
  processTalkPayment(supabase, purchasedSlotId).catch(error => {
    console.error('❌ 決済処理エラー:', error);
  });

  // その後、ルームを削除
  await deleteDailyRoom(purchasedSlot.video_call_room_id);
});
```

**実装ファイル:** `/backend/src/routes/calls.ts` (line 354-439)

**重要**: 手動終了時も決済処理を実行することで、Webhookが届かない場合でも決済が確実に処理されます。

### 3. 決済判定ロジック（`shouldCaptureTalkPayment`）

**ハイブリッド判定方式**: Daily.co Webhookイベントログの有無に応じて、最適な判定方法を選択します。

#### 方式A: Webhookイベントログが存在する場合（厳密な判定）

以下の3つの条件を**すべて満たす**場合のみ決済を確定:

**条件1: インフルエンサーが参加した**
```typescript
const influencerJoined = events.some((e) =>
  (e.event_type === 'participant.joined') &&
  (e.user_id === purchasedSlot.influencer_user_id)
);
```

**条件2: ルームが「規定時間経過による自動終了」になった**
```typescript
const roomEndedByDuration = events.some((e) =>
  (e.event_type === 'room.ended' || e.event_type === 'meeting.ended') &&
  (e.room_end_reason === 'duration')
);
```

**重要:**
- `room_end_reason === 'duration'` = Daily.coが設定した時間が経過して自動終了
- `room_end_reason === 'manual'` = 誰かが手動で終了ボタンを押した（規定時間前）

**条件3: インフルエンサーが途中退出していない**
```typescript
function hasInfluencerStayedFromStartToEnd(events, influencerUserId, scheduledStartTime, scheduledEndTime) {
  // インフルエンサーの参加・退出イベントを分析
  // 開始時刻から終了時刻まで連続参加しているか確認
}
```

#### 方式B: Webhookイベントログが存在しない場合（`purchased_slots`情報で判定）

`purchased_slots`テーブルの情報を使用して判定:

**条件1: インフルエンサーが参加した**
- `influencer_joined_at !== null`

**条件2: 開始時刻前に参加**
- `influencer_joined_at <= scheduled_start_time`

**条件3: 予定終了時刻まで留まっている**
- `call_ended_at >= scheduled_end_time`

**条件4: 途中退室の概算判定**
- `call_actual_duration_minutes >= duration_minutes`（概算判定）

**注意**: 方式Bでは途中退室の厳密な判定は困難なため、実際の通話時間で概算判定します。

**実装ファイル:** `/backend/src/services/paymentCapture.ts` (line 31-261)

### 4. 決済確定または与信キャンセル（`captureTalkPayment`）

#### ケースA: すべての条件を満たした場合 → 決済確定

```typescript
// 1. Payment Intentをcapture
const capturedPayment = await stripe.paymentIntents.capture(paymentIntentId);

// 2. payment_transactionsに記録（stripe_transfer_idはnullのまま）
await supabase.from('payment_transactions').insert({
  purchased_slot_id: purchasedSlotId,
  stripe_payment_intent_id: capturedPayment.id,
  stripe_charge_id: chargeId,
  amount: bidAmount,
  platform_fee: platformFee,
  influencer_payout: influencerPayout,
  status: 'captured',
  stripe_transfer_id: null, // TransferはWebhookで実行
});

// 3. purchased_slotsのステータスを更新
await supabase.from('purchased_slots').update({
  call_status: 'completed',
  call_ended_at: new Date().toISOString(),
}).eq('id', purchasedSlotId);

// 4. ユーザー統計を更新
await supabase.rpc('update_user_statistics', {
  p_fan_id: purchasedSlot.fan_user_id,
  p_influencer_id: purchasedSlot.influencer_user_id,
  p_amount: bidAmount,
});

// 注意: Transfer処理は実行しない（Stripe Webhookで実行）
```

#### ケースB: 条件を満たさない場合 → 与信キャンセル

```typescript
// 1. Payment Intentをキャンセル
await stripe.paymentIntents.cancel(paymentIntentId);

// 2. purchased_slotsのステータスを更新
await supabase.from('purchased_slots').update({
  call_status: 'cancelled',
  call_ended_at: new Date().toISOString(),
}).eq('id', purchasedSlotId);

// ファンのカードへの与信が解放され、課金されない
```

**実装ファイル:** `/backend/src/services/paymentCapture.ts` (line 368-578)

### 5. インフルエンサーへの送金（Stripe Webhook）

Stripe Webhook（`payment_intent.succeeded`）を受信した時点で、インフルエンサーへの送金（Transfer）を実行します。

```typescript
// /api/stripe/webhook エンドポイント
app.post('/api/stripe/webhook', async (req: Request, res: Response) => {
  const event = stripe.webhooks.constructEvent(...);

  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      
      // payment_transactionsを検索
      const { data: paymentTx } = await supabase
        .from('payment_transactions')
        .select('*, purchased_slots!inner(influencer_user_id)')
        .eq('stripe_payment_intent_id', paymentIntent.id)
        .is('stripe_transfer_id', null) // Transfer未実施のもの
        .single();

      if (paymentTx && paymentTx.purchased_slots?.influencer_user_id) {
        // インフルエンサー情報を取得
        const { data: influencer } = await supabase
          .from('users')
          .select('stripe_connect_account_id')
          .eq('id', paymentTx.purchased_slots.influencer_user_id)
          .single();

        if (influencer?.stripe_connect_account_id) {
          // Transferを実行
          const transfer = await stripe.transfers.create({
            amount: Math.round(paymentTx.influencer_payout),
            currency: 'jpy',
            destination: influencer.stripe_connect_account_id,
            transfer_group: paymentTx.purchased_slots.auction_id || paymentTx.purchased_slot_id,
          });

          // stripe_transfer_idを更新
          await supabase
            .from('payment_transactions')
            .update({ stripe_transfer_id: transfer.id })
            .eq('stripe_payment_intent_id', paymentIntent.id);
        }
      }
      break;
  }
});
```

**実装ファイル:** `/backend/src/server.ts` (line 1053-1120)

**メリット:**
- CaptureとTransferが分離され、プラットフォームアカウントへの入金確認後に送金される
- 残高不足エラーを回避できる
- エラーハンドリングが容易（Transfer失敗時のリトライ可能）

## データフロー図

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. オークション終了                                              │
│    /api/auctions/finalize-ended                                 │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
                ┌───────────────────┐
                │ purchased_slots   │
                │ status: 'pending' │
                │ (決済保留)         │
                └───────────────────┘
                        │
                        │ ファンとインフルエンサーがTalkを実施
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Daily.co Webhook受信                                         │
│    /api/daily/webhook                                           │
│    - participant.joined (入室)                                   │
│    - participant.left (退室)                                     │
│    - room.ended (終了)                                           │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
                ┌───────────────────┐
                │ daily_call_events │
                │ (イベントログ)      │
                └───────────────────┘
                        │
                        ▼ room.ended受信
┌─────────────────────────────────────────────────────────────────┐
│ 3. 決済判定 (processTalkPayment)                                │
│    shouldCaptureTalkPayment()                                   │
│                                                                  │
│    ✅ インフルエンサー参加？                                      │
│    ✅ 規定時間で自動終了？                                        │
│    ✅ 途中退出なし？                                             │
└───────────────────────┬─────────────────────────────────────────┘
                        │
            ┌───────────┴───────────┐
            │                       │
         【YES】                  【NO】
            │                       │
            ▼                       ▼
    ┌───────────────┐       ┌───────────────┐
    │ 決済確定        │       │ 与信キャンセル  │
    │ capture()     │       │ cancel()      │
    └───────┬───────┘       └───────┬───────┘
            │                       │
            ▼                       ▼
    ┌───────────────┐       ┌───────────────┐
    │ payment_      │       │ status:       │
    │ transactions  │       │ 'cancelled'   │
    │ status:       │       │               │
    │ 'captured'    │       │ ファンに課金なし│
    │ transfer_id:  │       └───────────────┘
    │ null          │
    │ (入金予定額)   │
    └───────┬───────┘
            │
            │ Stripe Webhook (payment_intent.succeeded)
            │
            ▼
    ┌───────────────┐
    │ Transfer実行  │
    │ stripe.       │
    │ transfers.    │
    │ create()      │
    └───────┬───────┘
            │
            ▼
    ┌───────────────┐
    │ payment_      │
    │ transactions  │
    │ transfer_id:  │
    │ 設定済み       │
    │ (総売上)       │
    └───────────────┘
```

## エラーケース一覧

### ケース1: インフルエンサーがno-show（不参加）

**イベントログ:**
- `participant.joined` (ファンのみ) ✓
- `participant.joined` (インフルエンサー) ✗ ← **不在**
- `room.ended` (reason: 'manual' or 'duration')

**判定結果:** `influencer_no_show`

**処理:**
- Payment Intentをキャンセル
- `call_status: 'cancelled'`
- ファンのカードへの与信を解放（課金なし）

---

### ケース2: インフルエンサーが途中退出

**イベントログ:**
- `participant.joined` (ファン) ✓
- `participant.joined` (インフルエンサー) ✓
- `participant.left` (インフルエンサー) ✓ ← **早期退出**
- `room.ended` (reason: 'duration')

**判定結果:** `influencer_left_early`

**処理:**
- Payment Intentをキャンセル
- `call_status: 'cancelled'`
- ファンのカードへの与信を解放（課金なし）

---

### ケース3: 規定時間前に手動終了

**イベントログ:**
- `participant.joined` (ファン) ✓
- `participant.joined` (インフルエンサー) ✓
- `room.ended` (reason: 'manual') ← **手動終了**

**判定結果:** `room_not_ended_by_duration`

**処理:**
- Payment Intentをキャンセル
- `call_status: 'cancelled'`
- ファンのカードへの与信を解放（課金なし）

**注:** インフルエンサーが善意で延長したい場合や、両者合意の早期終了でも課金されません。規定時間まで実施することが課金条件です。

---

### ケース4: 正常完了（課金される）

**イベントログ:**
- `participant.joined` (ファン) ✓
- `participant.joined` (インフルエンサー) ✓
- `room.ended` (reason: 'duration') ✓ ← **規定時間で自動終了**

**判定結果:** `completed_successfully`

**処理:**
- Payment Intentをcapture
- `call_status: 'completed'`
- `payment_transactions` レコード作成
- ファンのカードに課金確定

## Webhook設定

### Production環境

**Webhook URL:**
```
https://oshi-talk.com/api/daily/webhook
```

**設定コマンド:**
```bash
curl -X POST https://api.daily.co/v1/webhooks \
  -H "Authorization: Bearer ${DAILY_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://oshi-talk.com/api/daily/webhook"}'
```

**Webhook情報:**
- UUID: `e2f06847-84b4-4a06-b859-9b0993b321da`
- State: `ACTIVE`
- HMAC: `C/Kmm8Y7bvg1OZlMTb+r4F1H3DVc31VRDQoXjyvlvXQ=`
- Created: 2025-11-22

### Staging環境

**Webhook URL:**
```
https://staging.oshi-talk.com/api/daily/webhook
```

必要に応じて設定してください。

## テストシナリオ

### シナリオ1: 正常系

1. オークションで入札・落札
2. Talkルームに両者が入室
3. 規定時間（例: 5分）まで通話
4. Daily.coが自動終了
5. Webhook受信 → 決済確定 ✅

### シナリオ2: インフルエンサーno-show

1. オークションで入札・落札
2. ファンのみルーム入室
3. インフルエンサーが入室しない
4. ファンが退出または時間経過で終了
5. Webhook受信 → 与信キャンセル（課金なし） ✅

### シナリオ3: インフルエンサー途中退出

1. オークションで入札・落札
2. Talkルームに両者が入室
3. インフルエンサーが3分で退出
4. ファンが残り続けて5分経過
5. Webhook受信 → 与信キャンセル（課金なし） ✅

### シナリオ4: 手動早期終了

1. オークションで入札・落札
2. Talkルームに両者が入室
3. 3分経過時点でどちらかが「終了」ボタンを押す
4. ルームが手動終了
5. Webhook受信 → 与信キャンセル（課金なし） ✅

## インフルエンサーの売上表示

### マイページでの売上表示ロジック

`/api/stripe/influencer-earnings`エンドポイントで、以下の情報を返します:

```typescript
// payment_transactionsから集計
const { data: allTransactions } = await supabase
  .from('payment_transactions')
  .select('*')
  .eq('purchased_slots.influencer_user_id', user.id)
  .eq('status', 'captured');

// Transfer済み（総売上）
const totalEarnings = allTransactions
  .filter(tx => tx.stripe_transfer_id !== null)
  .reduce((sum, tx) => sum + tx.influencer_payout, 0);

// Transfer未実施（入金予定額）
const pendingPayout = allTransactions
  .filter(tx => tx.stripe_transfer_id === null)
  .reduce((sum, tx) => sum + tx.influencer_payout, 0);

// Stripe残高（参考情報）
const balance = await stripe.balance.retrieve({
  stripeAccount: user.stripe_connect_account_id,
});

res.json({
  totalEarnings,        // Transfer済み
  pendingPayout,        // Capture済み、Transfer未実施
  availableBalance: balance.available.reduce(...), // Stripe残高
  pendingBalance: balance.pending.reduce(...),     // Stripe保留中
});
```

**実装ファイル:** `/backend/src/server.ts` (line 673-805)

## 関連ファイル

| ファイル | 説明 |
|---------|------|
| `/backend/src/server.ts` | オークション終了処理（決済保留）、Stripe Webhook処理、売上データ取得 |
| `/backend/src/routes/dailyWebhook.ts` | Daily.co Webhook受信とイベント保存 |
| `/backend/src/services/paymentCapture.ts` | 決済判定ロジックとCapture実行 |
| `/supabase/migrations/20251113000000_initial_schema.sql` | DBスキーマ（daily_call_events, purchased_slots, payment_transactions） |
| `/src/components/InfluencerEarningsDashboard.tsx` | インフルエンサーの売上ダッシュボード |

## まとめ

この高度な決済フローにより:

✅ **公平性**: インフルエンサーがサービス提供しなかった場合、ファンに課金されない
✅ **自動化**: Webhookで完全自動判定・決済
✅ **透明性**: すべてのイベントログがDBに記録され、監査可能
✅ **拡張性**: 将来的に部分返金などのルールも追加可能

この仕組みにより、OshiTalkはファンとインフルエンサーの両方にとって信頼できるプラットフォームになります。
