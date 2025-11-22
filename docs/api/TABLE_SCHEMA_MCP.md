# Oshicall テーブル構成（MCP経由取得）

このドキュメントは、Supabase MCPサーバー経由で取得したOshicall-staging環境のテーブル構成です。

**取得日時**: 2025年1月13日  
**接続先**: `https://wioealhsienyubwegvdu.supabase.co` (Staging環境)

## データベース概要

- **総テーブル数**: 11テーブル
- **総ユーザー数**: 18名（インフルエンサー13名、ファン5名）
- **RLS有効**: 10テーブル（`daily_call_events`のみRLS無効）

## テーブル一覧

### 1. users (18行) - RLS有効 ✅

ユーザー情報を管理するテーブル（ファンとインフルエンサーの両方を含む）

| カラム名 | データ型 | 必須 | デフォルト値 | 制約 |
|---------|---------|------|------------|------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| auth_user_id | uuid | ✓ | - | UNIQUE, FK → auth.users.id |
| display_name | varchar | ✓ | - | - |
| bio | text | - | - | - |
| profile_image_url | text | - | - | - |
| stripe_customer_id | varchar(255) | - | - | UNIQUE |
| stripe_account_id | varchar(255) | - | - | UNIQUE |
| stripe_connect_account_id | text | - | - | - |
| stripe_connect_account_status | text | - | 'not_setup' | - |
| stripe_connect_payout_enabled | boolean | - | false | - |
| is_fan | boolean | - | true | - |
| is_influencer | boolean | - | false | - |
| has_payment_method | boolean | - | false | - |
| total_spent | numeric | - | 0 | - |
| total_calls_purchased | integer | - | 0 | - |
| is_verified | boolean | - | false | - |
| total_earnings | numeric | - | 0 | - |
| total_calls_completed | integer | - | 0 | - |
| average_rating | numeric | - | - | - |
| created_at | timestamptz | - | CURRENT_TIMESTAMP | - |
| updated_at | timestamptz | - | CURRENT_TIMESTAMP | - |

**外部キー参照元:**
- `call_slots.user_id`
- `call_slots.fan_user_id`
- `auctions.current_winner_id`
- `bids.user_id`
- `purchased_slots.fan_user_id`
- `purchased_slots.influencer_user_id`
- `reviews.fan_user_id`
- `reviews.influencer_user_id`
- `notifications.user_id`
- `call_logs.user_id`
- `daily_call_events.user_id`
- `follows.follower_id`
- `follows.following_id`

### 2. call_slots (33行) - RLS有効 ✅

通話枠を管理するテーブル

| カラム名 | データ型 | 必須 | デフォルト値 | 制約 |
|---------|---------|------|------------|------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| user_id | uuid | ✓ | - | FK → users.id |
| fan_user_id | uuid | - | - | FK → users.id |
| title | varchar | ✓ | - | - |
| description | text | - | - | - |
| scheduled_start_time | timestamptz | ✓ | - | - |
| duration_minutes | integer | ✓ | - | CHECK: duration_minutes > 0 |
| starting_price | numeric | ✓ | - | CHECK: starting_price >= 0 |
| buy_now_price | integer | - | - | 即決価格（円） |
| minimum_bid_increment | numeric | - | 100 | CHECK: minimum_bid_increment >= 0 |
| is_published | boolean | - | false | - |
| thumbnail_url | text | - | - | - |
| created_at | timestamptz | - | CURRENT_TIMESTAMP | - |
| updated_at | timestamptz | - | CURRENT_TIMESTAMP | - |

**外部キー参照元:**
- `auctions.call_slot_id`
- `purchased_slots.call_slot_id`

### 3. auctions (33行) - RLS有効 ✅

オークション情報を管理するテーブル

| カラム名 | データ型 | 必須 | デフォルト値 | 制約 |
|---------|---------|------|------------|------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| call_slot_id | uuid | ✓ | - | FK → call_slots.id, UNIQUE |
| status | auction_status | - | 'draft' | ENUM: draft, scheduled, active, ended, cancelled |
| start_time | timestamptz | ✓ | - | - |
| end_time | timestamptz | ✓ | - | - |
| auction_end_time | timestamptz | ✓ | - | - |
| current_highest_bid | numeric | - | - | - |
| current_winner_id | uuid | - | - | FK → users.id |
| total_bids_count | integer | - | 0 | - |
| unique_bidders_count | integer | - | 0 | - |
| created_at | timestamptz | - | CURRENT_TIMESTAMP | - |
| updated_at | timestamptz | - | CURRENT_TIMESTAMP | - |

**ENUM型: `auction_status`**
- `draft`: 下書き
- `scheduled`: 予定済み
- `active`: アクティブ
- `ended`: 終了
- `cancelled`: キャンセル

**外部キー参照元:**
- `bids.auction_id`
- `purchased_slots.auction_id`

### 4. bids (71行) - RLS有効 ✅

入札情報を管理するテーブル

| カラム名 | データ型 | 必須 | デフォルト値 | 制約 |
|---------|---------|------|------------|------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| auction_id | uuid | ✓ | - | FK → auctions.id |
| user_id | uuid | ✓ | - | FK → users.id |
| bid_amount | numeric | ✓ | - | CHECK: bid_amount > 0 |
| is_autobid | boolean | - | false | - |
| stripe_payment_intent_id | varchar(255) | - | - | - |
| created_at | timestamptz | - | CURRENT_TIMESTAMP | - |

### 5. purchased_slots (21行) - RLS有効 ✅

購入された通話枠を管理するテーブル

| カラム名 | データ型 | 必須 | デフォルト値 | 制約 |
|---------|---------|------|------------|------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| call_slot_id | uuid | ✓ | - | FK → call_slots.id, UNIQUE |
| auction_id | uuid | ✓ | - | FK → auctions.id |
| fan_user_id | uuid | ✓ | - | FK → users.id |
| influencer_user_id | uuid | ✓ | - | FK → users.id |
| winning_bid_amount | numeric | ✓ | - | - |
| platform_fee | numeric | ✓ | - | - |
| influencer_payout | numeric | ✓ | - | - |
| call_status | call_status | - | 'pending' | ENUM: pending, ready, in_progress, completed, cancelled, no_show |
| video_call_room_id | varchar(255) | - | - | - |
| call_started_at | timestamptz | - | - | - |
| call_ended_at | timestamptz | - | - | - |
| purchased_at | timestamptz | - | CURRENT_TIMESTAMP | - |
| daily_room_name | varchar(255) | - | - | - |
| daily_room_url | text | - | - | - |
| daily_room_created_at | timestamptz | - | - | - |
| influencer_joined_at | timestamptz | - | - | - |
| fan_joined_at | timestamptz | - | - | - |
| call_actual_duration_minutes | integer | - | - | - |

**ENUM型: `call_status`**
- `pending`: 保留中
- `ready`: 準備完了
- `in_progress`: 進行中
- `completed`: 完了
- `cancelled`: キャンセル
- `no_show`: ノーショー

**外部キー参照元:**
- `payment_transactions.purchased_slot_id`
- `reviews.purchased_slot_id`
- `call_logs.purchased_slot_id`
- `daily_call_events.purchased_slot_id`

### 6. payment_transactions (16行) - RLS有効 ✅

支払い取引を管理するテーブル

| カラム名 | データ型 | 必須 | デフォルト値 | 制約 |
|---------|---------|------|------------|------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| purchased_slot_id | uuid | ✓ | - | FK → purchased_slots.id |
| stripe_payment_intent_id | varchar(255) | ✓ | - | UNIQUE |
| stripe_charge_id | varchar(255) | - | - | UNIQUE |
| stripe_transfer_id | varchar(255) | - | - | - |
| amount | numeric | ✓ | - | - |
| platform_fee | numeric | ✓ | - | - |
| influencer_payout | numeric | ✓ | - | - |
| status | payment_status | - | 'pending' | ENUM: pending, authorized, captured, failed, refunded |
| error_message | text | - | - | - |
| created_at | timestamptz | - | CURRENT_TIMESTAMP | - |
| updated_at | timestamptz | - | CURRENT_TIMESTAMP | - |

**ENUM型: `payment_status`**
- `pending`: 保留中
- `authorized`: 承認済み
- `captured`: キャプチャ済み
- `failed`: 失敗
- `refunded`: 返金済み

### 7. reviews (0行) - RLS有効 ✅

レビューを管理するテーブル

| カラム名 | データ型 | 必須 | デフォルト値 | 制約 |
|---------|---------|------|------------|------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| purchased_slot_id | uuid | ✓ | - | FK → purchased_slots.id, UNIQUE |
| fan_user_id | uuid | ✓ | - | FK → users.id |
| influencer_user_id | uuid | ✓ | - | FK → users.id |
| rating | integer | ✓ | - | CHECK: rating >= 1 AND rating <= 5 |
| comment | text | - | - | - |
| is_public | boolean | - | true | - |
| created_at | timestamptz | - | CURRENT_TIMESTAMP | - |
| updated_at | timestamptz | - | CURRENT_TIMESTAMP | - |

### 8. follows (5行) - RLS有効 ✅

ユーザー間のフォロー関係を管理するテーブル

| カラム名 | データ型 | 必須 | デフォルト値 | 説明 |
|---------|---------|------|------------|------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| follower_id | uuid | ✓ | - | FK → users.id（フォローする側） |
| following_id | uuid | ✓ | - | FK → users.id（フォローされる側） |
| created_at | timestamptz | - | now() | - |

### 9. notifications (0行) - RLS有効 ✅

通知を管理するテーブル

| カラム名 | データ型 | 必須 | デフォルト値 | 制約 |
|---------|---------|------|------------|------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| user_id | uuid | ✓ | - | FK → users.id |
| type | varchar(50) | ✓ | - | - |
| title | varchar(200) | ✓ | - | - |
| message | text | ✓ | - | - |
| related_entity_type | varchar(50) | - | - | - |
| related_entity_id | uuid | - | - | - |
| is_read | boolean | - | false | - |
| created_at | timestamptz | - | CURRENT_TIMESTAMP | - |

### 10. call_logs (0行) - RLS有効 ✅

通話ログを管理するテーブル

| カラム名 | データ型 | 必須 | デフォルト値 | 制約 |
|---------|---------|------|------------|------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| purchased_slot_id | uuid | ✓ | - | FK → purchased_slots.id |
| event_type | varchar(255) | ✓ | - | - |
| participant_type | varchar(255) | - | - | - |
| data | jsonb | - | - | - |
| user_id | uuid | - | - | FK → users.id |
| created_at | timestamptz | - | CURRENT_TIMESTAMP | - |

### 11. daily_call_events (0行) - RLS無効 ⚠️

Daily.co通話イベントを管理するテーブル

| カラム名 | データ型 | 必須 | デフォルト値 | 制約 |
|---------|---------|------|------------|------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| purchased_slot_id | uuid | ✓ | - | FK → purchased_slots.id |
| event_type | daily_event_type | ✓ | - | ENUM |
| user_id | uuid | - | - | FK → users.id |
| participant_id | varchar(255) | - | - | - |
| event_data | jsonb | - | - | - |
| room_end_reason | varchar(255) | - | - | - |
| created_at | timestamptz | - | CURRENT_TIMESTAMP | - |

**ENUM型: `daily_event_type`**
- `participant-joined`: 参加者が参加
- `participant-left`: 参加者が退出
- `room-ended`: ルーム終了
- `meeting-ended`: ミーティング終了

⚠️ **注意**: このテーブルはRLSが無効になっています。必要に応じてRLSポリシーを設定してください。

## ENUM型定義

### auction_status
```sql
CREATE TYPE auction_status AS ENUM (
  'draft',
  'scheduled',
  'active',
  'ended',
  'cancelled'
);
```

### call_status
```sql
CREATE TYPE call_status AS ENUM (
  'pending',
  'ready',
  'in_progress',
  'completed',
  'cancelled',
  'no_show'
);
```

### payment_status
```sql
CREATE TYPE payment_status AS ENUM (
  'pending',
  'authorized',
  'captured',
  'failed',
  'refunded'
);
```

### daily_event_type
```sql
CREATE TYPE daily_event_type AS ENUM (
  'participant-joined',
  'participant-left',
  'room-ended',
  'meeting-ended'
);
```

## テーブル関係図

```
users (中心テーブル)
  ├── call_slots (user_id, fan_user_id)
  │   ├── auctions (call_slot_id)
  │   │   ├── bids (auction_id)
  │   │   └── purchased_slots (auction_id)
  │   └── purchased_slots (call_slot_id)
  │       ├── payment_transactions (purchased_slot_id)
  │       ├── reviews (purchased_slot_id)
  │       ├── call_logs (purchased_slot_id)
  │       └── daily_call_events (purchased_slot_id)
  ├── bids (user_id)
  ├── purchased_slots (fan_user_id, influencer_user_id)
  ├── reviews (fan_user_id, influencer_user_id)
  ├── notifications (user_id)
  ├── call_logs (user_id)
  ├── daily_call_events (user_id)
  └── follows (follower_id, following_id)
```

## データ統計

- **users**: 18行
- **call_slots**: 33行
- **auctions**: 33行
- **bids**: 71行
- **purchased_slots**: 21行
- **payment_transactions**: 16行
- **reviews**: 0行
- **notifications**: 0行
- **call_logs**: 0行
- **follows**: 5行
- **daily_call_events**: 0行

## インストール済み拡張機能

主要な拡張機能:
- `plpgsql` (1.0) - PL/pgSQL procedural language
- `pg_cron` (1.6.4) - Job scheduler
- `pg_net` (0.19.5) - Async HTTP
- `pg_graphql` (1.5.11) - GraphQL support
- `pgcrypto` (1.3) - Cryptographic functions
- `uuid-ossp` (1.1) - UUID generation
- `pg_stat_statements` (1.11) - Query statistics
- `supabase_vault` (0.3.1) - Supabase Vault Extension

## 注意事項

1. **RLS設定**: `daily_call_events`テーブルのみRLSが無効です。必要に応じてRLSポリシーを設定してください。
2. **外部キー制約**: すべてのテーブルで適切な外部キー制約が設定されています。
3. **CHECK制約**: `call_slots`、`bids`、`reviews`テーブルにCHECK制約が設定されています。
4. **UNIQUE制約**: 適切なカラムにUNIQUE制約が設定されています。

## 更新履歴

- 2025年1月13日: MCPサーバー経由で取得・作成

