# Phase 2: 実装方針

## 対象
- 業務仕様: /docs/business/video-call.md の BR-008, BR-009, BR-010
- 機能仕様: /docs/functional/video-call-entry.md

## 実装方針

### Issue #1（入室状態表示）の修正

**修正ファイル**: 
- `backend/src/routes/calls.ts`
- `src/components/calls/CallWaitingRoom.tsx`
- `supabase/migrations/`（手動で作成）

**変更内容**:

1. **データベースマイグレーション（手動）**
   - `purchased_slots` テーブルに以下を追加:
     - `influencer_entered_waiting_room_at TIMESTAMP WITH TIME ZONE`
     - `fan_entered_waiting_room_at TIMESTAMP WITH TIME ZONE`

2. **`backend/src/routes/calls.ts` - `/api/calls/create-room`**
   - CallPage入室時刻を記録する処理を追加
   - インフルエンサーの場合: `influencer_entered_waiting_room_at` を現在時刻で更新
   - ファンの場合: `fan_entered_waiting_room_at` を現在時刻で更新
   - 既に入室済みの場合は更新しない（重複更新防止）

3. **`backend/src/routes/calls.ts` - `/api/calls/status/:purchasedSlotId`**
   - レスポンスに以下を追加:
     - `participants.influencer_entered_waiting_room`: `influencer_entered_waiting_room_at` が存在するか
     - `participants.fan_entered_waiting_room`: `fan_entered_waiting_room_at` が存在するか

4. **`src/components/calls/CallWaitingRoom.tsx`**
   - 入室状態表示ロジックを変更:
     - `status.participants.influencer_entered_waiting_room` と `status.participants.influencer_joined` を確認
     - `status.participants.fan_entered_waiting_room` と `status.participants.fan_joined` を確認
     - 表示ロジック:
       - CallPage入室済み + Daily.co未接続 → 「待機中」
       - CallPage入室済み + Daily.co接続済み → 「通話中」
       - CallPage未入室 → 「未入室」

### Issue #2（15分前入室）の修正

**修正ファイル**: 
- `backend/src/routes/calls.ts`
- `src/components/calls/CallWaitingRoom.tsx`

**変更内容**:

1. **`backend/src/routes/calls.ts` - `/api/calls/create-room`**
   - インフルエンサーの場合、15分前チェックを追加:
     - `minutesUntilStart >= 15` の場合のみ許可
     - 15分前未満の場合は `400 Bad Request` を返す（エラーメッセージ: "インフルエンサーは通話開始時刻の15分前から入室できます"）
   - ファンの場合、制限なし（いつでも入室可能）

2. **`backend/src/routes/calls.ts` - `/api/calls/join-room`**
   - インフルエンサーの場合、15分前チェックを追加:
     - `minutesUntilStart >= 15` の場合のみ許可
     - 15分前未満の場合は `400 Bad Request` を返す（エラーメッセージ: "インフルエンサーは通話開始時刻の15分前から接続できます"）
   - ファンの場合、開始時刻チェックを追加:
     - `minutesUntilStart <= 0` の場合のみ許可
     - 開始時刻前の場合は `400 Bad Request` を返す（エラーメッセージ: "ファンは通話開始時刻から接続できます"）

3. **`src/components/calls/CallWaitingRoom.tsx`**
   - インフルエンサーの場合:
     - 15分前から「通話を開始する」ボタンを有効化
     - `canJoin` の計算を変更: `timeUntilStart <= 15 * 60`
   - ファンの場合:
     - 開始時刻前は「通話を開始する」ボタンを無効化
     - 開始時刻になったら自動的に `/api/calls/join-room` を呼び出し
     - 自動接続の実装:
       ```typescript
       useEffect(() => {
         if (userType !== 'fan') return;
         if (timeUntilStart > 0) return;
         if (status?.participants.fan_joined) return; // 既に接続済み
         
         const autoJoin = async () => {
           await handleJoinClick();
         };
         
         autoJoin();
       }, [timeUntilStart, userType, status]);
       ```

## 実装順序

1. **データベースマイグレーション（手動）**
   - `purchased_slots` テーブルに `influencer_entered_waiting_room_at`, `fan_entered_waiting_room_at` を追加
   - マイグレーションファイルは手動で作成

2. **バックエンド: `/api/calls/create-room` の修正**
   - CallPage入室時刻記録を追加
   - インフルエンサーの15分前チェックを追加

3. **バックエンド: `/api/calls/join-room` の修正**
   - インフルエンサーの15分前チェックを追加
   - ファンの開始時刻チェックを追加

4. **バックエンド: `/api/calls/status/:purchasedSlotId` の修正**
   - CallPage入室状態を返すように変更

5. **フロントエンド: `CallWaitingRoom.tsx` の修正**
   - 入室状態表示の改善
   - インフルエンサーの15分前入室対応
   - ファンの自動接続実装

## リスク・影響範囲

### 既存機能への影響

1. **既存の `influencer_joined_at` / `fan_joined_at` の使用**
   - 影響: なし（既存フィールドは維持、Daily.coセッション入室時刻として使用）
   - 対応: 既存のコードは変更不要

2. **既存の入室フロー**
   - 影響: 軽微（CallPage入室時刻の記録が追加されるのみ）
   - 対応: 後方互換性を維持（既存の動作は維持）

3. **既存のステータス取得API**
   - 影響: 中（レスポンス形式が変更される）
   - 対応: 既存のフィールド（`influencer_joined`, `fan_joined`）は維持し、新しいフィールドを追加

4. **既存のテスト**
   - 影響: 中（テストケースの更新が必要）
   - 対応: E2Eテストを更新（`e2e/video-call-entry.spec.ts`）

### 技術的リスク

1. **データベースマイグレーション**
   - リスク: 既存データへの影響
   - 対応: 既存データは `NULL` のまま（新規フィールドは `NULL` 許可）

2. **自動接続のタイミング**
   - リスク: 開始時刻の1秒以内に実行されない可能性
   - 対応: `setInterval` で1秒ごとにチェック（既存のカウントダウンタイマーと同様）

3. **15分前チェックの精度**
   - リスク: サーバー時刻とクライアント時刻のずれ
   - 対応: サーバー側でチェック（`backend/src/routes/calls.ts`）

## テスト計画

1. **単体テスト**: 各APIエンドポイントの動作確認
2. **統合テスト**: フロントエンドとバックエンドの連携確認
3. **E2Eテスト**: `e2e/video-call-entry.spec.ts` のテストケースを有効化して実行

## 承認後の実装

承認後、以下の順序で実装を進めます：

1. データベースマイグレーション（手動で作成）
2. バックエンド修正（1ファイルずつ）
3. フロントエンド修正
4. テスト実行・確認

各変更後に報告し、次の変更に進みます。

---

**作成日**: 2025-01-XX

