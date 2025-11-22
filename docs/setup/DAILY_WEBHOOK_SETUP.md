# Daily.co Webhook設定ガイド

## 概要

Daily.coでは、WebhookをREST APIを使って設定します。ダッシュボードからの設定UIはありません。

このガイドでは、オークション終了後の決済処理でDaily.coのイベントログを使用するために必要なWebhook設定方法を説明します。

---

## 前提条件

- Daily.co APIキー (`DAILY_API_KEY`) が環境変数に設定されている
- アプリケーションが公開URL（HTTPS）でアクセス可能
  - 開発環境の場合は ngrok などを使用

---

## Webhook設定方法

### 方法1: 管理APIエンドポイントを使用（推奨）

アプリケーションに組み込まれた管理APIを使用します。

#### 1. Webhook一覧を確認

```bash
curl -X GET https://your-app.com/api/daily-admin/webhooks \
  -H "Content-Type: application/json"
```

**レスポンス例:**
```json
{
  "success": true,
  "webhooks": [
    {
      "id": "webhook-uuid",
      "url": "https://your-app.com/api/daily/webhook",
      "event_types": ["participant.joined", "participant.left", "room.ended"],
      "state": "ACTIVE"
    }
  ],
  "count": 1
}
```

#### 2. Webhookを作成

```bash
curl -X POST https://your-app.com/api/daily-admin/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "webhookUrl": "https://your-app.com/api/daily/webhook"
  }'
```

**レスポンス例:**
```json
{
  "success": true,
  "webhook": {
    "id": "webhook-uuid",
    "url": "https://your-app.com/api/daily/webhook",
    "event_types": [
      "participant.joined",
      "participant.left",
      "room.ended",
      "meeting.ended"
    ],
    "state": "ACTIVE",
    "hmac": "secret-for-verification"
  },
  "message": "Webhook作成成功"
}
```

#### 3. Webhookを削除（必要な場合）

```bash
curl -X DELETE https://your-app.com/api/daily-admin/webhooks/webhook-uuid \
  -H "Content-Type: application/json"
```

---

### 方法2: Daily.co APIを直接使用

```bash
curl -X POST https://api.daily.co/v1/webhooks \
  -H "Authorization: Bearer YOUR_DAILY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/api/daily/webhook",
    "event_types": [
      "participant.joined",
      "participant.left",
      "room.ended",
      "meeting.ended"
    ],
    "retry_config": "circuit-breaker"
  }'
```

---

## 受信するイベント

### 1. `participant.joined`
参加者がルームに入室したとき

**Payload例:**
```json
{
  "type": "participant.joined",
  "room": {
    "name": "call-purchased-slot-uuid",
    "url": "https://oshicall.daily.co/call-purchased-slot-uuid"
  },
  "participant": {
    "participant_id": "abc123",
    "user_id": "supabase-user-uuid",
    "user_name": "ユーザー名"
  },
  "timestamp": "2025-01-01T12:00:00Z"
}
```

### 2. `participant.left`
参加者がルームから退出したとき

**Payload例:**
```json
{
  "type": "participant.left",
  "room": {
    "name": "call-purchased-slot-uuid"
  },
  "participant": {
    "participant_id": "abc123",
    "user_id": "supabase-user-uuid",
    "user_name": "ユーザー名"
  },
  "timestamp": "2025-01-01T12:30:00Z"
}
```

### 3. `room.ended` / `meeting.ended`
ルームが終了したとき

**Payload例:**
```json
{
  "type": "room.ended",
  "room": {
    "name": "call-purchased-slot-uuid"
  },
  "end_reason": "duration",  // "duration" | "manual" | "error"
  "timestamp": "2025-01-01T13:00:00Z"
}
```

**`end_reason`の種類:**
- `duration`: 規定時間経過による自動終了（課金対象）
- `manual`: 手動終了（課金対象外）
- `error`: エラーによる終了（課金対象外）

---

## Webhook検証（セキュリティ）

Daily.coからのWebhookリクエストには、HMAC署名が含まれています。

### 署名検証の実装

```typescript
import crypto from 'crypto';

function verifyDailyWebhook(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(hmac)
  );
}

// Express エンドポイント
app.post('/api/daily/webhook', (req, res) => {
  const signature = req.headers['x-daily-signature'] as string;
  const payload = JSON.stringify(req.body);

  if (!verifyDailyWebhook(payload, signature, DAILY_WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Webhook処理...
});
```

---

## トラブルシューティング

### Webhookが届かない

1. **URL確認**
   - HTTPSを使用していますか？
   - URLに認証が必要になっていませんか？

2. **Webhook状態確認**
   ```bash
   curl -X GET https://your-app.com/api/daily-admin/webhooks
   ```
   `state`が`FAILED`になっている場合は、再作成が必要です。

3. **ログ確認**
   ```bash
   heroku logs --tail | grep "Daily.co Webhook"
   ```

### Webhook検証失敗

- Daily.coから返された`hmac`シークレットを環境変数に設定してください
- リクエストボディを改変せずに検証してください（JSON文字列のまま）

---

## デプロイ後の設定手順

### 1. Herokuデプロイ後

```bash
# 1. Webhook作成
curl -X POST https://oshicall-2936440db16b.herokuapp.com/api/daily-admin/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "webhookUrl": "https://oshicall-2936440db16b.herokuapp.com/api/daily/webhook"
  }'

# 2. 作成されたWebhookを確認
curl -X GET https://oshicall-2936440db16b.herokuapp.com/api/daily-admin/webhooks
```

### 2. 環境変数の確認

```bash
heroku config:get DAILY_API_KEY
```

設定されていない場合：
```bash
heroku config:set DAILY_API_KEY=your_daily_api_key
```

---

## 次のステップ

Webhook設定が完了したら、以下のドキュメントに従って実装を進めてください：

1. **データベーススキーマ追加**: `docs/DAILY_EVENTS_TABLE.md`
2. **Webhook受信エンドポイント**: `docs/DAILY_WEBHOOK_HANDLER.md`
3. **決済判定ロジック**: `docs/PAYMENT_CAPTURE_LOGIC.md`

---

## 参考リンク

- [Daily.co Webhook API Documentation](https://docs.daily.co/reference/rest-api/webhooks)
- [Daily.co Webhook Events](https://docs.daily.co/reference/rest-api/webhooks/events)
- [Daily.co REST API](https://docs.daily.co/reference/rest-api)
