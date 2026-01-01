# Daily.co ビデオ通話セットアップガイド

## 📝 前提条件

- ✅ Daily.co アカウント作成済み
- ⏳ Daily.co API キー取得（これから）
- ⏳ 環境変数設定（これから）

---

## 🔑 ステップ 1: Daily.co API キーの取得

### 1-1. Daily.co ダッシュボードにログイン

https://dashboard.daily.co/ にアクセス

### 1-2. API キーを取得

1. 左サイドバーの「**Developers**」をクリック
2. 「**API Keys**」タブを選択
3. 既存のキーが表示されるか、「**Create API key**」をクリック
4. キーをコピー（`xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`の形式）

### 1-3. ドメインを確認（オプション）

1. 「**Domains**」タブを選択
2. デフォルトドメインを確認（例: `oshicall.daily.co`）
3. またはカスタムドメインを作成

---

## 🔧 ステップ 2: 環境変数の設定

### ローカル環境

`backend/.env` に既に追加済み：

```bash
# Daily.co設定
DAILY_API_KEY=your_daily_api_key_here  ← 実際のAPIキーに置き換え
DAILY_DOMAIN=oshicall  ← あなたのDaily.coドメイン
```

### Heroku 環境

```bash
# Daily.co APIキーを設定
heroku config:set DAILY_API_KEY=your_actual_api_key -a oshicall

# ドメインを設定
heroku config:set DAILY_DOMAIN=oshicall -a oshicall

# 確認
heroku config -a oshicall | grep DAILY
```

---

## 📊 データベーススキーマ確認

`purchased_slots`テーブルに以下のカラムが必要です：

```sql
-- 既存カラムを確認
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'purchased_slots';

-- 必要なカラム（なければ追加）:
-- - video_call_room_id (VARCHAR)
-- - influencer_joined_at (TIMESTAMP)
-- - fan_joined_at (TIMESTAMP)
-- - call_actual_duration_minutes (INTEGER)
```

もしカラムが不足していたら、以下の SQL で追加：

```sql
-- video_call_room_id カラム（ルーム名を保存）
ALTER TABLE purchased_slots
ADD COLUMN IF NOT EXISTS video_call_room_id VARCHAR(255);

-- 参加日時カラム
ALTER TABLE purchased_slots
ADD COLUMN IF NOT EXISTS influencer_joined_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE purchased_slots
ADD COLUMN IF NOT EXISTS fan_joined_at TIMESTAMP WITH TIME ZONE;

-- 実際の通話時間
ALTER TABLE purchased_slots
ADD COLUMN IF NOT EXISTS call_actual_duration_minutes INTEGER;
```

---

## 🧪 ステップ 3: API テスト

### テスト 1: 通話ルーム作成

```bash
curl -X POST http://localhost:3001/api/calls/create-room \
  -H "Content-Type: application/json" \
  -d '{
    "purchasedSlotId": "落札したslot_id",
    "userId": "あなたのuser_id"
  }' | jq '.'
```

期待される出力：

```json
{
  "success": true,
  "roomUrl": "https://oshicall.daily.co/call-xxx",
  "token": "eyJhbGc...",
  "callSlot": {
    "title": "...",
    "scheduled_start_time": "...",
    "duration_minutes": 30
  },
  "timeUntilStart": 300
}
```

### テスト 2: 通話ステータス取得

```bash
curl http://localhost:3001/api/calls/status/your_purchased_slot_id | jq '.'
```

期待される出力：

```json
{
  "status": "ready",
  "scheduled_start_time": "2025-10-15T10:00:00Z",
  "duration_minutes": 30,
  "time_until_start_seconds": 300,
  "participants": {
    "influencer_joined": false,
    "fan_joined": false
  },
  "can_join": true,
  "room_created": true
}
```

---

## 🎯 実装完了チェックリスト

### バックエンド

- [x] `backend/src/utils/daily.ts` - Daily.co ユーティリティ
- [x] `backend/src/routes/calls.ts` - 通話エンドポイント
- [x] `backend/src/server.ts` - ルーター統合
- [x] パッケージインストール (`@daily-co/daily-js`, `axios`)

### 環境変数

- [ ] Daily.co API キー取得
- [ ] ローカル: `backend/.env` に設定
- [ ] Heroku: 環境変数設定

### データベース

- [ ] `purchased_slots`のカラム確認
- [ ] 不足カラムの追加（必要に応じて）

### テスト

- [ ] ルーム作成 API テスト
- [ ] ステータス取得 API テスト

---

## 🚀 次のステップ

1. Daily.co API キーを取得
2. 環境変数を設定
3. バックエンドを再起動
4. API をテスト
5. フロントエンドのビデオ通話 UI を実装

---

まず、Daily.co API キーを取得して教えてください！
