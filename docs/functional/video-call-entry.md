# ビデオ通話入室機能

## 対応する業務仕様

- [/docs/business/video-call.md](../business/video-call.md) の BR-008, BR-009, BR-010

## 概要

ビデオ通話の入室状態表示と入室タイミングを管理する機能。インフルエンサーとファンの入室状態を正確に表示し、適切なタイミングでDaily.coセッションに接続できるようにします。

## 機能要件

### FR-001: 入室状態の管理
- **対応BR**: BR-008
- **説明**: 
  - 現状: `influencer_joined_at` / `fan_joined_at` は `/api/calls/join-room` で設定される（Daily.coセッションに入室した時のみ）
  - 問題: CallPageに入っただけでは `joined_at` が設定されないため、両方とも「待機中」と表示される
  - 解決策: CallPageに入室した時点を記録する新しいフィールドを追加
- **変更内容**:
  - `purchased_slots` テーブルに新しいフィールドを追加:
    - `influencer_entered_waiting_room_at`: インフルエンサーがCallPageに入室した時刻
    - `fan_entered_waiting_room_at`: ファンがCallPageに入室した時刻
  - `/api/calls/create-room` でCallPage入室時刻を記録
  - `/api/calls/status/:purchasedSlotId` で入室状態を返す際に、CallPage入室とDaily.co接続を区別
  - `CallWaitingRoom.tsx` で入室状態を正確に表示

### FR-002: インフルエンサーの早期入室
- **対応BR**: BR-009
- **説明**: 
  - 現状: Daily.coルームの `nbf` は15分前に設定されているが、`/api/calls/create-room` で時刻チェックが行われていない
  - 現状: `backend/src/routes/calls.ts` の87行目に「待機室にはいつでも入室可能（15分制限を削除）」というコメントがある
  - 問題: インフルエンサーとファンの入室タイミングの違いが実装されていない
- **変更内容**:
  - `/api/calls/create-room` でインフルエンサーの場合、15分前チェックを追加
  - `/api/calls/join-room` でインフルエンサーの場合、15分前チェックを追加（Daily.co接続時）
  - `CallWaitingRoom.tsx` でインフルエンサーの場合、15分前から「通話を開始する」ボタンを有効化

### FR-003: ファンの自動接続
- **対応BR**: BR-010
- **説明**: 
  - 現状: ファンは開始時刻になっても自動接続されない
  - 現状: ファンは手動で「通話を開始する」ボタンをクリックする必要がある
- **変更内容**:
  - `CallWaitingRoom.tsx` でファンの場合、開始時刻になったら自動的にDaily.coセッションに接続
  - 開始時刻前は「通話を開始する」ボタンを無効化
  - 開始時刻になったら自動的に `/api/calls/join-room` を呼び出し、Daily.coセッションに接続

## 技術設計

### データ構造

#### purchased_slots テーブル（追加フィールド）

```sql
-- 既存フィールド
influencer_joined_at TIMESTAMP WITH TIME ZONE  -- Daily.coセッションに入室した時刻
fan_joined_at TIMESTAMP WITH TIME ZONE          -- Daily.coセッションに入室した時刻

-- 追加フィールド（新規）
influencer_entered_waiting_room_at TIMESTAMP WITH TIME ZONE  -- CallPageに入室した時刻
fan_entered_waiting_room_at TIMESTAMP WITH TIME ZONE         -- CallPageに入室した時刻
```

**注意**: マイグレーションファイルは手動で作成するため、ここでは定義のみ記載

### API設計

#### POST /api/calls/create-room（変更）

**変更内容**:
1. インフルエンサーの場合、15分前チェックを追加
2. CallPage入室時刻を記録（`influencer_entered_waiting_room_at` または `fan_entered_waiting_room_at`）

**リクエスト**: 変更なし
```json
{
  "purchasedSlotId": "uuid",
  "userId": "uuid"
}
```

**レスポンス**: 変更なし
```json
{
  "success": true,
  "roomUrl": "https://...",
  "token": "...",
  "callSlot": {...},
  "timeUntilStart": 900
}
```

**処理フロー**:
1. ユーザー確認（インフルエンサー/ファン判定）
2. **インフルエンサーの場合**: 15分前チェック（15分前未満の場合はエラー）
3. **ファンの場合**: いつでも入室可能（制限なし）
4. CallPage入室時刻を記録（`influencer_entered_waiting_room_at` または `fan_entered_waiting_room_at`）
5. ルーム作成（既存ロジック）
6. トークン生成（既存ロジック）

#### POST /api/calls/join-room（変更）

**変更内容**:
1. インフルエンサーの場合、15分前チェックを追加（Daily.co接続時）
2. ファンの場合、開始時刻チェックを追加（開始時刻前の場合はエラー）

**リクエスト**: 変更なし
```json
{
  "purchasedSlotId": "uuid",
  "userId": "uuid"
}
```

**レスポンス**: 変更なし
```json
{
  "success": true,
  "roomUrl": "https://...",
  "token": "...",
  "userName": "..."
}
```

**処理フロー**:
1. ユーザー確認（インフルエンサー/ファン判定）
2. **インフルエンサーの場合**: 15分前チェック（15分前未満の場合はエラー）
3. **ファンの場合**: 開始時刻チェック（開始時刻前の場合はエラー）
4. Daily.coセッション入室時刻を記録（`influencer_joined_at` または `fan_joined_at`）
5. トークン生成（既存ロジック）

#### GET /api/calls/status/:purchasedSlotId（変更）

**変更内容**:
1. CallPage入室状態とDaily.co接続状態を区別して返す

**レスポンス**: 変更
```json
{
  "status": "ready",
  "scheduled_start_time": "2025-01-15T14:30:00Z",
  "duration_minutes": 30,
  "time_until_start_seconds": 900,
  "participants": {
    "influencer_entered_waiting_room": true,  // 新規: CallPageに入室済み
    "influencer_joined": true,                // 既存: Daily.coセッションに入室済み
    "fan_entered_waiting_room": false,        // 新規: CallPageに入室済み
    "fan_joined": false                       // 既存: Daily.coセッションに入室済み
  },
  "can_join": true,
  "room_created": true
}
```

**処理フロー**:
1. `purchased_slots` を取得
2. CallPage入室状態を判定（`influencer_entered_waiting_room_at` / `fan_entered_waiting_room_at` が存在するか）
3. Daily.co接続状態を判定（`influencer_joined_at` / `fan_joined_at` が存在するか）
4. 両方を返す

### フロントエンド設計

#### CallPage.tsx（変更なし）

変更不要

#### CallWaitingRoom.tsx（変更）

**変更内容**:
1. 入室状態表示の改善
   - `status.participants.influencer_entered_waiting_room` と `status.participants.influencer_joined` を確認
   - 自分がCallPage入室済み、相手が未入室 → 自分: 待機中、相手: 未入室
   - 両者がCallPage入室済み → 両者: 待機中
   - 両者がDaily.co接続済み → 両者: 通話中
2. インフルエンサーの15分前入室対応
   - インフルエンサーの場合、15分前から「通話を開始する」ボタンを有効化
3. ファンの自動接続
   - ファンの場合、開始時刻になったら自動的に `/api/calls/join-room` を呼び出し
   - 開始時刻前は「通話を開始する」ボタンを無効化

**表示ロジック**:
```typescript
// インフルエンサーの状態表示
const influencerStatus = 
  status.participants.influencer_joined ? '通話中' :
  status.participants.influencer_entered_waiting_room ? '待機中' :
  '未入室';

// ファンの状態表示
const fanStatus = 
  status.participants.fan_joined ? '通話中' :
  status.participants.fan_entered_waiting_room ? '待機中' :
  '未入室';
```

**自動接続ロジック（ファンのみ）**:
```typescript
useEffect(() => {
  if (userType !== 'fan') return;
  if (timeUntilStart > 0) return;
  if (status?.participants.fan_joined) return; // 既に接続済み

  // 開始時刻になったら自動接続
  const autoJoin = async () => {
    await handleJoinClick();
  };
  
  autoJoin();
}, [timeUntilStart, userType, status]);
```

**入室ボタンの有効化条件**:
```typescript
// インフルエンサー: 15分前から有効
// ファン: 開始時刻から有効
const canJoinDaily = userType === 'influencer' 
  ? timeUntilStart <= 15 * 60  // 15分前
  : timeUntilStart <= 0;        // 開始時刻

const isButtonDisabled = 
  !canJoinDaily || 
  !cameraPermission || 
  !micPermission ||
  (userType === 'fan' && timeUntilStart > 0); // ファンは開始時刻前は無効
```

## 関連ファイル

### 変更が必要なファイル

#### バックエンド
- `backend/src/routes/calls.ts`
  - `/api/calls/create-room`: CallPage入室時刻記録、インフルエンサー15分前チェック追加
  - `/api/calls/join-room`: インフルエンサー15分前チェック、ファン開始時刻チェック追加
  - `/api/calls/status/:purchasedSlotId`: CallPage入室状態を返すように変更

#### フロントエンド
- `src/components/calls/CallWaitingRoom.tsx`
  - 入室状態表示の改善
  - インフルエンサーの15分前入室対応
  - ファンの自動接続実装

#### データベース
- `supabase/migrations/`（手動で作成）
  - `purchased_slots` テーブルに `influencer_entered_waiting_room_at`, `fan_entered_waiting_room_at` を追加

### 参照ファイル（変更不要）
- `src/pages/CallPage.tsx`
- `src/api/calls.ts`
- `backend/src/utils/daily.ts`

## 実装上の注意事項

1. **データベースマイグレーション**: マイグレーションファイルは手動で作成する
2. **後方互換性**: 既存の `influencer_joined_at` / `fan_joined_at` は維持（Daily.coセッション入室時刻として使用）
3. **エラーハンドリング**: 15分前未満でインフルエンサーが入室しようとした場合、適切なエラーメッセージを返す
4. **自動接続のタイミング**: ファンの自動接続は開始時刻の1秒以内に実行されるようにする

## 変更履歴

| 日付 | 変更内容 | 理由 |
|------|----------|------|
| 2025-01-XX | 初回作成 | Issue #1, #2対応のための機能仕様作成 |

