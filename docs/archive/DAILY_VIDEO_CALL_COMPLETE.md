# 🎥 Daily.co ビデオ通話機能 実装完了

## ✅ 実装完了内容

### バックエンド
- ✅ `backend/src/utils/daily.ts` - Daily.co API ユーティリティ
  - createDailyRoom() - ルーム作成
  - getDailyRoomInfo() - ルーム情報取得
  - deleteDailyRoom() - ルーム削除
  - generateMeetingToken() - 参加トークン生成

- ✅ `backend/src/routes/calls.ts` - 通話エンドポイント
  - POST /api/calls/create-room - ルーム作成
  - POST /api/calls/join-room - ルーム参加
  - POST /api/calls/end-call - 通話終了
  - GET /api/calls/status/:purchasedSlotId - ステータス取得

### フロントエンド
- ✅ `src/api/calls.ts` - API関数
- ✅ `src/components/calls/CallWaitingRoom.tsx` - 待機画面
- ✅ `src/components/calls/VideoCall.tsx` - ビデオ通話
- ✅ `src/components/calls/CallReviewPrompt.tsx` - レビュー画面
- ✅ `src/pages/CallPage.tsx` - 通話ページ統合
- ✅ `src/App.tsx` - ルーティング追加

---

## 🔑 セットアップ手順

### ステップ1: Daily.co APIキーを取得

1. https://dashboard.daily.co/ にログイン（または新規登録）
2. 左サイドバー → 「**Developers**」
3. 「**API Keys**」タブ
4. APIキーをコピー

### ステップ2: データベースにカラムを追加

Supabase SQL Editorで `add_daily_columns.sql` を実行：

```sql
-- purchased_slotsテーブルにDaily.co関連カラムを追加

-- video_call_room_id カラム
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchased_slots' AND column_name = 'video_call_room_id'
  ) THEN
    ALTER TABLE purchased_slots 
    ADD COLUMN video_call_room_id VARCHAR(255);
  END IF;
END $$;

-- 参加日時カラム
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchased_slots' AND column_name = 'influencer_joined_at'
  ) THEN
    ALTER TABLE purchased_slots 
    ADD COLUMN influencer_joined_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchased_slots' AND column_name = 'fan_joined_at'
  ) THEN
    ALTER TABLE purchased_slots 
    ADD COLUMN fan_joined_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- 実際の通話時間
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchased_slots' AND column_name = 'call_actual_duration_minutes'
  ) THEN
    ALTER TABLE purchased_slots 
    ADD COLUMN call_actual_duration_minutes INTEGER;
  END IF;
END $$;
```

### ステップ3: 環境変数を設定

#### ローカル環境

`backend/.env` を編集（Daily.co APIキーに置き換え）：

```bash
DAILY_API_KEY=your_actual_daily_api_key_here
DAILY_DOMAIN=oshicall
```

#### Heroku環境

```bash
heroku config:set DAILY_API_KEY=your_actual_daily_api_key -a oshicall
heroku config:set DAILY_DOMAIN=oshicall -a oshicall
```

### ステップ4: バックエンドを再起動

```bash
# ローカル
pkill -f "ts-node src/server.ts"
cd backend && npm run dev
```

---

## 🧪 テスト手順

### 1. 通話ページにアクセス

```
http://localhost:5173/call/1c6d8b01-6911-45e4-8363-e265e64a4a7f
```

（`1c6d8b01...`は、あなたのpurchased_slot_idに置き換え）

### 2. 待機画面を確認

- ✅ カウントダウンタイマーが表示
- ✅ カメラ・マイクの許可確認
- ✅ デバイスチェック表示
- ✅ 「通話ルームに入る」ボタン（15分前から有効）

### 3. 通話を開始

1. 「通話ルームに入る」ボタンをクリック
2. Daily.coの通話画面が表示される
3. カメラとマイクが動作することを確認

### 4. 通話を終了

1. 「通話を終了」ボタンをクリック
2. レビュー画面が表示される（ファンの場合）
3. 星評価とコメントを入力
4. 「レビューを投稿」をクリック

---

## 📊 データフロー

```
【落札後】
purchased_slots作成
  ↓
call_status: 'pending'

【通話15分前】
ファン/インフルエンサーが /call/:purchasedSlotId にアクセス
  ↓
create-room API呼び出し
  ↓
Daily.coルーム作成
  ↓
video_call_room_id保存
call_status: 'ready'

【通話開始】
「入室」ボタンクリック
  ↓
join-room API呼び出し
  ↓
ミーティングトークン生成
  ↓
Daily.coに参加
  ↓
influencer_joined_at / fan_joined_at記録
call_started_at記録
call_status: 'in_progress'

【通話終了】
「終了」ボタンまたは自動終了
  ↓
end-call API呼び出し
  ↓
call_ended_at記録
call_actual_duration_minutes計算
call_status: 'completed'
  ↓
Daily.coルーム削除
  ↓
レビュー画面表示（ファンのみ）
```

---

## 🔐 セキュリティ

### 1. ルームアクセス制御
- ✅ private roomのみ
- ✅ ミーティングトークン必須
- ✅ 最大2人まで
- ✅ 時間制限付き（nbf, exp）

### 2. ユーザー認証
- ✅ Supabase認証必須
- ✅ purchased_slotのowner確認
- ✅ influencer_idまたはfan_idの照合

### 3. トークン管理
- ✅ APIキーはバックエンドのみ
- ✅ ミーティングトークンは24時間有効
- ✅ ユーザーごとに個別トークン

---

## 📝 Daily.coルーム設定

```typescript
{
  name: "call-{purchasedSlotId}",
  privacy: "private",
  properties: {
    max_participants: 2,
    nbf: scheduled_start_time - 15分,  // 15分前から入室可
    exp: scheduled_start_time + duration + 10分,  // 終了10分後まで有効
    enable_chat: true,
    enable_screenshare: true,
    start_video_off: false,
    start_audio_off: false,
    enable_prejoin_ui: false,
    enable_network_ui: true,
    enable_noise_cancellation_ui: true
  }
}
```

---

## 🎯 実装済み機能

### 待機画面
- ✅ カウントダウンタイマー
- ✅ デバイスチェック（カメラ・マイク）
- ✅ 参加者状況表示
- ✅ 15分前から入室可能
- ✅ 注意事項表示

### ビデオ通話画面
- ✅ Daily.co Prebuilt UI統合
- ✅ 残り時間カウントダウン
- ✅ 参加者数表示
- ✅ 通話終了ボタン
- ✅ 自動終了（時間切れ）

### レビュー画面
- ✅ 5つ星評価
- ✅ コメント入力
- ✅ レビュー投稿
- ✅ スキップ機能

---

## 🚨 重要な注意事項

### HTTPS必須
- ローカル開発: `localhost`は自動的にHTTPS扱い ✅
- 本番環境: Herokuは自動的にHTTPS ✅

### Daily.co無料プラン制限
- 同時通話数: 5ルームまで
- 参加者数: 1通話2人まで（設定済み）
- ルーム保持: 使用後は削除（実装済み）

### タイムゾーン
- データベース: UTC保存（Supabaseデフォルト）
- 表示: ユーザーのローカルタイムゾーン（toLocaleString使用）

---

## 🧪 次のテスト

### 準備

1. Supabase SQL Editorで `add_daily_columns.sql` を実行
2. Daily.co APIキーを取得
3. `backend/.env`のDAILY_API_KEYを更新
4. バックエンド再起動

### テスト

```
# ルーム作成テスト
curl -X POST http://localhost:3001/api/calls/create-room \
  -H "Content-Type: application/json" \
  -d '{
    "purchasedSlotId": "1c6d8b01-6911-45e4-8363-e265e64a4a7f",
    "userId": "1c54a85e-ce34-4314-963d-89dfa928b308"
  }' | jq '.'
```

期待される出力：
```json
{
  "success": true,
  "roomUrl": "https://oshicall.daily.co/call-xxx",
  "token": "eyJhbGc...",
  "callSlot": {...},
  "timeUntilStart": 300
}
```

---

準備ができました！Daily.co APIキーを取得して教えてください 🚀

