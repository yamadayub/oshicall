# Oshicall-staging テーブル構成

このドキュメントは、SupabaseのREST APIから取得したOshicall-staging環境のテーブル構成です。

取得日時: 2025年1月13日

## テーブル一覧

### 1. users
ユーザー情報を管理するテーブル（ファンとインフルエンサーの両方を含む）

| カラム名 | 型 | 必須 | デフォルト値 | 説明 |
|---------|-----|------|------------|------|
| id | uuid | ✓ | gen_random_uuid() | プライマリキー |
| auth_user_id | uuid | ✓ | - | Supabase認証ユーザーID |
| display_name | varchar(100) | ✓ | - | 表示名 |
| bio | text | - | - | 自己紹介 |
| profile_image_url | text | - | - | プロフィール画像URL |
| stripe_customer_id | varchar(255) | - | - | Stripe顧客ID |
| stripe_account_id | varchar(255) | - | - | StripeアカウントID |
| stripe_connect_account_id | text | - | - | Stripe ConnectアカウントID |
| stripe_connect_account_status | text | - | not_setup | Stripe Connectアカウントステータス |
| stripe_connect_payout_enabled | boolean | - | false | Stripe Connect支払い有効化フラグ |
| is_fan | boolean | - | true | ファンかどうか |
| is_influencer | boolean | - | false | インフルエンサーかどうか |
| has_payment_method | boolean | - | false | 支払い方法登録済みかどうか |
| total_spent | numeric | - | 0 | 総支出額 |
| total_calls_purchased | integer | - | 0 | 購入した通話数 |
| is_verified | boolean | - | false | 認証済みかどうか |
| total_earnings | numeric | - | 0 | 総収益 |
| total_calls_completed | integer | - | 0 | 完了した通話数 |
| average_rating | numeric | - | - | 平均評価 |
| created_at | timestamptz | - | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | timestamptz | - | CURRENT_TIMESTAMP | 更新日時 |

### 2. call_slots
通話枠を管理するテーブル

| カラム名 | 型 | 必須 | デフォルト値 | 説明 |
|---------|-----|------|------------|------|
| id | uuid | ✓ | gen_random_uuid() | プライマリキー |
| user_id | uuid | ✓ | - | インフルエンサーID (users.id) |
| fan_user_id | uuid | - | - | ファンID (users.id) - 即決購入時 |
| title | varchar(200) | ✓ | - | タイトル |
| description | text | - | - | 説明 |
| scheduled_start_time | timestamptz | ✓ | - | 予定開始時刻 |
| duration_minutes | integer | ✓ | - | 通話時間（分） |
| starting_price | numeric | ✓ | - | 開始価格 |
| buy_now_price | integer | - | - | 即決価格（円）。NULLの場合は即決価格なし |
| minimum_bid_increment | numeric | - | 100 | 最小入札増額 |
| is_published | boolean | - | false | 公開済みかどうか |
| thumbnail_url | text | - | - | サムネイル画像URL |
| created_at | timestamptz | - | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | timestamptz | - | CURRENT_TIMESTAMP | 更新日時 |

**外部キー:**
- `user_id` → `users.id`
- `fan_user_id` → `users.id`

### 3. auctions
オークション情報を管理するテーブル

| カラム名 | 型 | 必須 | デフォルト値 | 説明 |
|---------|-----|------|------------|------|
| id | uuid | ✓ | gen_random_uuid() | プライマリキー |
| call_slot_id | uuid | ✓ | - | 通話枠ID (call_slots.id) |
| status | auction_status | - | draft | ステータス (draft, scheduled, active, ended, cancelled) |
| start_time | timestamptz | ✓ | - | 開始時刻 |
| end_time | timestamptz | ✓ | - | 終了時刻 |
| auction_end_time | timestamptz | ✓ | - | オークション終了時刻 |
| current_highest_bid | numeric | - | - | 現在の最高入札額 |
| current_winner_id | uuid | - | - | 現在の勝者ID (users.id) |
| total_bids_count | integer | - | 0 | 総入札数 |
| unique_bidders_count | integer | - | 0 | ユニーク入札者数 |
| created_at | timestamptz | - | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | timestamptz | - | CURRENT_TIMESTAMP | 更新日時 |

**外部キー:**
- `call_slot_id` → `call_slots.id`
- `current_winner_id` → `users.id`

**ENUM型:**
- `auction_status`: draft, scheduled, active, ended, cancelled

### 4. bids
入札情報を管理するテーブル

| カラム名 | 型 | 必須 | デフォルト値 | 説明 |
|---------|-----|------|------------|------|
| id | uuid | ✓ | gen_random_uuid() | プライマリキー |
| auction_id | uuid | ✓ | - | オークションID (auctions.id) |
| user_id | uuid | ✓ | - | 入札者ID (users.id) |
| bid_amount | numeric | ✓ | - | 入札額 |
| is_autobid | boolean | - | false | 自動入札かどうか |
| stripe_payment_intent_id | varchar(255) | - | - | Stripe支払いインテントID |
| created_at | timestamptz | - | CURRENT_TIMESTAMP | 作成日時 |

**外部キー:**
- `auction_id` → `auctions.id`
- `user_id` → `users.id`

### 5. purchased_slots
購入された通話枠を管理するテーブル

| カラム名 | 型 | 必須 | デフォルト値 | 説明 |
|---------|-----|------|------------|------|
| id | uuid | ✓ | gen_random_uuid() | プライマリキー |
| call_slot_id | uuid | ✓ | - | 通話枠ID (call_slots.id) |
| auction_id | uuid | ✓ | - | オークションID (auctions.id) |
| fan_user_id | uuid | ✓ | - | ファンID (users.id) |
| influencer_user_id | uuid | ✓ | - | インフルエンサーID (users.id) |
| winning_bid_amount | numeric | ✓ | - | 落札額 |
| platform_fee | numeric | ✓ | - | プラットフォーム手数料 |
| influencer_payout | numeric | ✓ | - | インフルエンサーへの支払い額 |
| call_status | call_status | - | pending | 通話ステータス |
| video_call_room_id | varchar(255) | - | - | ビデオ通話ルームID |
| call_started_at | timestamptz | - | - | 通話開始時刻 |
| call_ended_at | timestamptz | - | - | 通話終了時刻 |
| purchased_at | timestamptz | - | CURRENT_TIMESTAMP | 購入日時 |
| daily_room_name | varchar(255) | - | - | Daily.coルーム名 |
| daily_room_url | text | - | - | Daily.coルームURL |
| daily_room_created_at | timestamptz | - | - | Daily.coルーム作成日時 |
| influencer_joined_at | timestamptz | - | - | インフルエンサー参加時刻 |
| fan_joined_at | timestamptz | - | - | ファン参加時刻 |
| call_actual_duration_minutes | integer | - | - | 実際の通話時間（分） |

**外部キー:**
- `call_slot_id` → `call_slots.id`
- `auction_id` → `auctions.id`
- `fan_user_id` → `users.id`
- `influencer_user_id` → `users.id`

**ENUM型:**
- `call_status`: pending, ready, in_progress, completed, cancelled, no_show

### 6. payment_transactions
支払い取引を管理するテーブル

| カラム名 | 型 | 必須 | デフォルト値 | 説明 |
|---------|-----|------|------------|------|
| id | uuid | ✓ | gen_random_uuid() | プライマリキー |
| purchased_slot_id | uuid | ✓ | - | 購入スロットID (purchased_slots.id) |
| stripe_payment_intent_id | varchar(255) | ✓ | - | Stripe支払いインテントID |
| stripe_charge_id | varchar(255) | - | - | StripeチャージID |
| stripe_transfer_id | varchar(255) | - | - | Stripe転送ID |
| amount | numeric | ✓ | - | 金額 |
| platform_fee | numeric | ✓ | - | プラットフォーム手数料 |
| influencer_payout | numeric | ✓ | - | インフルエンサーへの支払い額 |
| status | payment_status | - | pending | ステータス |
| error_message | text | - | - | エラーメッセージ |
| created_at | timestamptz | - | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | timestamptz | - | CURRENT_TIMESTAMP | 更新日時 |

**外部キー:**
- `purchased_slot_id` → `purchased_slots.id`

**ENUM型:**
- `payment_status`: pending, authorized, captured, failed, refunded

### 7. reviews
レビューを管理するテーブル

| カラム名 | 型 | 必須 | デフォルト値 | 説明 |
|---------|-----|------|------------|------|
| id | uuid | ✓ | gen_random_uuid() | プライマリキー |
| purchased_slot_id | uuid | ✓ | - | 購入スロットID (purchased_slots.id) |
| fan_user_id | uuid | ✓ | - | ファンID (users.id) |
| influencer_user_id | uuid | ✓ | - | インフルエンサーID (users.id) |
| rating | integer | ✓ | - | 評価（1-5など） |
| comment | text | - | - | コメント |
| is_public | boolean | - | true | 公開かどうか |
| created_at | timestamptz | - | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | timestamptz | - | CURRENT_TIMESTAMP | 更新日時 |

**外部キー:**
- `purchased_slot_id` → `purchased_slots.id`
- `fan_user_id` → `users.id`
- `influencer_user_id` → `users.id`

### 8. follows
ユーザー間のフォロー関係を管理するテーブル

| カラム名 | 型 | 必須 | デフォルト値 | 説明 |
|---------|-----|------|------------|------|
| id | uuid | ✓ | gen_random_uuid() | プライマリキー |
| follower_id | uuid | ✓ | - | フォローする側のユーザーID (users.id) |
| following_id | uuid | ✓ | - | フォローされる側のユーザーID（インフルエンサー）(users.id) |
| created_at | timestamptz | - | now() | 作成日時 |

**外部キー:**
- `follower_id` → `users.id`
- `following_id` → `users.id`

### 9. user_following
フォロー中のユーザー情報を表示するビュー（推定）

| カラム名 | 型 | 説明 |
|---------|-----|------|
| user_id | uuid | ユーザーID (users.id) |
| following_id | uuid | フォロー中のユーザーID (users.id) |
| following_name | varchar(100) | フォロー中のユーザー名 |
| following_image | text | フォロー中のユーザー画像 |
| followed_at | timestamptz | フォロー日時 |

### 10. user_followers
フォロワー情報を表示するビュー（推定）

| カラム名 | 型 | 説明 |
|---------|-----|------|
| user_id | uuid | ユーザーID (users.id) |
| follower_id | uuid | フォロワーID (users.id) |
| follower_name | varchar(100) | フォロワー名 |
| follower_image | text | フォロワー画像 |
| followed_at | timestamptz | フォロー日時 |

### 11. notifications
通知を管理するテーブル

| カラム名 | 型 | 必須 | デフォルト値 | 説明 |
|---------|-----|------|------------|------|
| id | uuid | ✓ | gen_random_uuid() | プライマリキー |
| user_id | uuid | ✓ | - | ユーザーID (users.id) |
| type | varchar(50) | ✓ | - | 通知タイプ |
| title | varchar(200) | ✓ | - | タイトル |
| message | text | ✓ | - | メッセージ |
| related_entity_type | varchar(50) | - | - | 関連エンティティタイプ |
| related_entity_id | uuid | - | - | 関連エンティティID |
| is_read | boolean | - | false | 既読かどうか |
| created_at | timestamptz | - | CURRENT_TIMESTAMP | 作成日時 |

**外部キー:**
- `user_id` → `users.id`

### 12. call_logs
通話ログを管理するテーブル

| カラム名 | 型 | 必須 | デフォルト値 | 説明 |
|---------|-----|------|------------|------|
| id | uuid | ✓ | gen_random_uuid() | プライマリキー |
| purchased_slot_id | uuid | ✓ | - | 購入スロットID (purchased_slots.id) |
| event_type | varchar(255) | ✓ | - | イベントタイプ |
| participant_type | varchar(255) | - | - | 参加者タイプ |
| data | jsonb | - | - | イベントデータ |
| user_id | uuid | - | - | ユーザーID (users.id) |
| created_at | timestamptz | - | CURRENT_TIMESTAMP | 作成日時 |

**外部キー:**
- `purchased_slot_id` → `purchased_slots.id`
- `user_id` → `users.id`

### 13. daily_call_events
Daily.co通話イベントを管理するテーブル

| カラム名 | 型 | 必須 | デフォルト値 | 説明 |
|---------|-----|------|------------|------|
| id | uuid | ✓ | gen_random_uuid() | プライマリキー |
| purchased_slot_id | uuid | ✓ | - | 購入スロットID (purchased_slots.id) |
| event_type | daily_event_type | ✓ | - | イベントタイプ |
| user_id | uuid | - | - | ユーザーID (users.id) |
| participant_id | varchar(255) | - | - | 参加者ID |
| event_data | jsonb | - | - | イベントデータ |
| room_end_reason | varchar(255) | - | - | ルーム終了理由 |
| created_at | timestamptz | - | CURRENT_TIMESTAMP | 作成日時 |

**外部キー:**
- `purchased_slot_id` → `purchased_slots.id`
- `user_id` → `users.id`

**ENUM型:**
- `daily_event_type`: (定義はOpenAPIスキーマから取得)

### 14. active_auctions_view
アクティブなオークションを表示するビュー

| カラム名 | 型 | 説明 |
|---------|-----|------|
| auction_id | uuid | オークションID（プライマリキー） |
| call_slot_id | uuid | 通話枠ID（プライマリキー） |
| influencer_id | uuid | インフルエンサーID（プライマリキー） |
| status | auction_status | ステータス |
| start_time | timestamptz | 開始時刻 |
| end_time | timestamptz | 終了時刻 |
| current_highest_bid | numeric | 現在の最高入札額 |
| total_bids_count | integer | 総入札数 |
| title | varchar(200) | タイトル |
| description | text | 説明 |
| scheduled_start_time | timestamptz | 予定開始時刻 |
| duration_minutes | integer | 通話時間（分） |
| starting_price | numeric | 開始価格 |
| thumbnail_url | text | サムネイル画像URL |
| influencer_name | varchar(100) | インフルエンサー名 |
| influencer_image | text | インフルエンサー画像 |
| average_rating | numeric | 平均評価 |

## ENUM型定義

### auction_status
- `draft`: 下書き
- `scheduled`: 予定済み
- `active`: アクティブ
- `ended`: 終了
- `cancelled`: キャンセル

### call_status
- `pending`: 保留中
- `ready`: 準備完了
- `in_progress`: 進行中
- `completed`: 完了
- `cancelled`: キャンセル
- `no_show`: ノーショー

### payment_status
- `pending`: 保留中
- `authorized`: 承認済み
- `captured`: キャプチャ済み
- `failed`: 失敗
- `refunded`: 返金済み

## テーブル関係図

```
users
  ├── call_slots (user_id)
  ├── bids (user_id)
  ├── purchased_slots (fan_user_id, influencer_user_id)
  ├── reviews (fan_user_id, influencer_user_id)
  ├── follows (follower_id, following_id)
  ├── notifications (user_id)
  ├── call_logs (user_id)
  └── daily_call_events (user_id)

call_slots
  ├── auctions (call_slot_id)
  └── purchased_slots (call_slot_id)

auctions
  ├── bids (auction_id)
  └── purchased_slots (auction_id)

purchased_slots
  ├── payment_transactions (purchased_slot_id)
  ├── reviews (purchased_slot_id)
  ├── call_logs (purchased_slot_id)
  └── daily_call_events (purchased_slot_id)
```

## 注意事項

- このドキュメントはSupabaseのREST API（OpenAPIスキーマ）から自動生成されました
- ビュー（`active_auctions_view`, `user_following`, `user_followers`）の詳細な定義は、実際のSQL定義を確認する必要があります
- ENUM型の一部（`daily_event_type`など）の詳細な値は、データベースのスキーマ定義を直接確認する必要があります



