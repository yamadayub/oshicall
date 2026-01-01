# Call Status Management（通話ステータス管理）

## 概要

`call_slots`テーブルの`status`カラムを通話ライフサイクルに応じて正しく更新する機能。通話枠の状態を`planned`（予定済み）→`live`（実施中）→`completed`（完了）と適切に遷移させ、システム全体で通話の状態を正確に追跡できるようにします。

**ビジネス価値**:
- 通話枠の状態を正確に把握できる
- ステータスに基づいた適切な表示・処理が可能になる
- ユーザーが通話の進行状況を正確に確認できる

## 現状の問題

### 問題1: statusが全てPlannedのまま更新されていない

- `call_slots`テーブルの`status`カラムが作成時のデフォルト値`'planned'`のまま更新されていない
- オークション落札後（`purchased_slots`作成時）に`'live'`に更新されていない
- 通話終了時に`'completed'`に更新されていない

### 問題2: ステータス更新処理が実装されていない

以下のタイミングで`call_slots.status`を更新する処理が存在しない：

1. **`purchased_slots`作成時**: オークション落札や即決購入時に`call_slots.status`を`'live'`に更新する処理がない
2. **通話終了時**: `purchased_slots.call_status`が`'completed'`になった時に`call_slots.status`を`'completed'`に更新する処理がない

### 問題3: 定義されている関数が使用されていない

`supabase/migrations/20251205000001_add_all_missing_rpc_functions.sql`に以下の関数が定義されているが、トリガーとして設定されておらず、実際には使用されていない：

- `update_call_slot_status_live()`: `purchased_slots`作成時に`call_slots.status`を`'live'`に更新
- `update_call_slot_status_completed()`: 通話終了時に`call_slots.status`を`'completed'`に更新

## ステータス遷移図

```
planned → live → completed
            ↘ cancelled
```

### ステータス定義

- **`planned`**: 通話枠が作成された状態（デフォルト値）。オークション開催前、または未落札状態
- **`live`**: オークションが落札され、`purchased_slots`が作成された状態。通話実施待ち、または実施中
- **`completed`**: 通話が正常に完了した状態
- **`cancelled`**: 通話がキャンセルされた状態（将来実装予定）

### ステータス遷移のタイミング

1. **`planned` → `live`**: 
   - `purchased_slots`テーブルにレコードが作成された時点
   - オークション終了時（`finalize-auctions` Edge Function）
   - 即決購入時（`/api/buy-now`エンドポイント）

2. **`live` → `completed`**: 
   - `purchased_slots.call_status`が`'completed'`に更新された時点
   - 通話終了処理時（`/api/calls/end-call`エンドポイント）
   - Daily.co Webhookで`room.ended`イベント受信時（オプション）

## 機能要件

### FR-001: purchased_slots作成時のstatus更新

**説明**: オークション落札や即決購入で`purchased_slots`が作成された時に、対応する`call_slots.status`を`'live'`に更新する

**受け入れ条件**:
- [ ] オークション終了時（`supabase/functions/finalize-auctions/index.ts`）に`call_slots.status`を`'live'`に更新する
- [ ] 即決購入時（`backend/src/server.ts`の`/api/buy-now`）に`call_slots.status`を`'live'`に更新する
- [ ] 更新対象の`call_slot_id`を`purchased_slots.call_slot_id`から取得する
- [ ] 更新失敗時もエラーログを記録し、処理を継続する（`purchased_slots`の作成自体は成功させる）

**実装箇所**:
- `supabase/functions/finalize-auctions/index.ts`（`purchased_slots`作成後）
- `backend/src/server.ts`（`/api/buy-now`エンドポイント、`purchased_slots`作成後）

**関連ファイル**:
- `supabase/migrations/20251205000001_add_all_missing_rpc_functions.sql`（関数定義はあるが未使用）

---

### FR-002: 通話終了時のstatus更新

**説明**: 通話が終了し、`purchased_slots.call_status`が`'completed'`に更新された時に、対応する`call_slots.status`を`'completed'`に更新する

**受け入れ条件**:
- [ ] `/api/calls/end-call`エンドポイントで`purchased_slots.call_status`を`'completed'`に更新する際、同時に`call_slots.status`も`'completed'`に更新する
- [ ] 更新対象の`call_slot_id`を`purchased_slots.call_slot_id`から取得する
- [ ] 更新失敗時もエラーログを記録するが、`purchased_slots`の更新は成功させる

**実装箇所**:
- `backend/src/routes/calls.ts`（`/end-call`エンドポイント、`purchased_slots`更新時）

**関連ファイル**:
- `backend/src/routes/dailyWebhook.ts`（オプション: `room.ended`イベント受信時にも更新）

---

### FR-003: 既存データの整合性確保

**説明**: 既存の`call_slots`レコードで`purchased_slots`が存在する場合は、`status`を適切な値に更新する

**受け入れ条件**:
- [ ] マイグレーションスクリプトまたは修正スクリプトを作成する
- [ ] `purchased_slots`が存在し、`call_status`が`'completed'`の場合は`call_slots.status`を`'completed'`に更新する
- [ ] `purchased_slots`が存在し、`call_status`が`'completed'`以外の場合は`call_slots.status`を`'live'`に更新する

**実装箇所**:
- `sql/migrations/`または`supabase/migrations/`にマイグレーションファイルを作成

---

## 非機能要件

### パフォーマンス
- **NFR-001**: `call_slots.status`の更新処理は500ms以内に完了する
- **NFR-002**: 既存データの一括更新はバッチ処理で実行し、データベース負荷を最小限に抑える

### 信頼性
- **NFR-003**: `call_slots.status`の更新失敗時も`purchased_slots`の処理は継続する（部分失敗を許容）
- **NFR-004**: 更新処理のエラーは適切にログ記録される

### データ整合性
- **NFR-005**: `call_slots.status`と`purchased_slots.call_status`の整合性が保たれる
- **NFR-006**: トランザクション処理を適切に使用し、データの不整合を防ぐ

## 実装詳細

### 更新処理の実装方法

#### 方法1: アプリケーションコード内で直接更新（推奨）

各処理箇所で`purchased_slots`の操作と同時に`call_slots.status`を更新する。

**メリット**:
- 実装がシンプル
- デバッグが容易
- エラーハンドリングが明確

**実装例**:
```typescript
// purchased_slots作成後
await supabase
  .from('call_slots')
  .update({ status: 'live' })
  .eq('id', callSlotId);
```

#### 方法2: データベーストリガーを使用

`purchased_slots`テーブルにトリガーを設定し、INSERT/UPDATE時に自動的に`call_slots.status`を更新する。

**メリット**:
- アプリケーションコードへの影響が少ない
- データベース側で整合性が保証される

**デメリット**:
- デバッグが難しい
- エラーハンドリングが複雑
- 既存の関数定義（`update_call_slot_status_live`など）を修正する必要がある

### 更新タイミング

1. **`planned` → `live`**:
   - `supabase/functions/finalize-auctions/index.ts`: `purchased_slots` INSERT後
   - `backend/src/server.ts`: `/api/buy-now`エンドポイント、`purchased_slots` INSERT後

2. **`live` → `completed`**:
   - `backend/src/routes/calls.ts`: `/end-call`エンドポイント、`purchased_slots.call_status`更新時
   - （オプション）`backend/src/routes/dailyWebhook.ts`: `room.ended`イベント受信時

## 関連する他の要件

- [BR-001: オークション機能](./BR-001-auction.md) - オークション終了時の`purchased_slots`作成
- [BR-002: Talk（通話）機能](./BR-002-talk.md) - 通話終了処理
- [BR-003: 決済機能](./BR-003-payment.md) - 通話完了後の決済処理

## 変更履歴

| 日付 | 変更内容 | 理由 |
|------|----------|------|
| 2025-01-XX | 初回作成 | call_slotsステータス更新問題の調査結果を元に要件定義 |

## 備考

### 実装優先度
- **高**: `purchased_slots`作成時の`status`更新（FR-001）
- **高**: 通話終了時の`status`更新（FR-002）
- **中**: 既存データの整合性確保（FR-003）

### 既知の制約
- 既存の`call_slots`レコードは`status`が`'planned'`のままになっている
- `update_call_slot_status_live()`および`update_call_slot_status_completed()`関数は定義されているが、トリガーとして設定されていない

### 将来の拡張
- `cancelled`ステータスの実装
- ステータス更新履歴の記録（監査ログ）
- ステータス更新のWebhook通知
