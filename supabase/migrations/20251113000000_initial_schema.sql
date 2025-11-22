-- ============================================
-- 初期スキーマ作成マイグレーション
-- Staging環境から取得したスキーマをProduction環境に適用
-- ============================================

-- ============================================
-- ENUM型の作成
-- ============================================

-- オークションステータス
CREATE TYPE auction_status AS ENUM ('draft', 'scheduled', 'active', 'ended', 'cancelled');

-- コールスロットステータス
CREATE TYPE call_slot_status AS ENUM ('planned', 'live', 'completed');

-- コールステータス
CREATE TYPE call_status AS ENUM ('pending', 'ready', 'in_progress', 'completed', 'cancelled', 'no_show');

-- Dailyイベントタイプ
CREATE TYPE daily_event_type AS ENUM ('participant-joined', 'participant-left', 'room-ended', 'meeting-ended');

-- 支払いステータス
CREATE TYPE payment_status AS ENUM ('pending', 'authorized', 'captured', 'failed', 'refunded');

-- ユーザータイプ
CREATE TYPE user_type AS ENUM ('influencer', 'fan');

-- ============================================
-- テーブルの作成（依存関係の順序）
-- ============================================

-- usersテーブル（最も基本的なテーブル）
CREATE TABLE users (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    auth_user_id uuid NOT NULL,
    display_name character varying(100) NOT NULL,
    bio text,
    profile_image_url text,
    stripe_customer_id character varying(255),
    stripe_account_id character varying(255),
    stripe_connect_account_id text,
    stripe_connect_account_status text DEFAULT 'not_setup'::text,
    stripe_connect_payout_enabled boolean DEFAULT false,
    is_fan boolean DEFAULT true,
    is_influencer boolean DEFAULT false,
    has_payment_method boolean DEFAULT false,
    total_spent numeric DEFAULT 0,
    total_calls_purchased integer DEFAULT 0,
    is_verified boolean DEFAULT false,
    total_earnings numeric DEFAULT 0,
    total_calls_completed integer DEFAULT 0,
    average_rating numeric,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- call_slotsテーブル
CREATE TABLE call_slots (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    scheduled_start_time timestamp with time zone NOT NULL,
    duration_minutes integer NOT NULL,
    starting_price numeric NOT NULL,
    minimum_bid_increment numeric DEFAULT 100,
    thumbnail_url text,
    is_published boolean DEFAULT false,
    buy_now_price integer,
    fan_user_id uuid,
    end_time timestamp with time zone NOT NULL,
    status call_slot_status DEFAULT 'planned'::call_slot_status,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- auctionsテーブル
CREATE TABLE auctions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    call_slot_id uuid NOT NULL,
    status auction_status DEFAULT 'draft'::auction_status,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    current_highest_bid numeric,
    current_winner_id uuid,
    total_bids_count integer DEFAULT 0,
    unique_bidders_count integer DEFAULT 0,
    auction_end_time timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- purchased_slotsテーブル
CREATE TABLE purchased_slots (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    call_slot_id uuid NOT NULL,
    auction_id uuid NOT NULL,
    fan_user_id uuid NOT NULL,
    influencer_user_id uuid NOT NULL,
    winning_bid_amount numeric NOT NULL,
    platform_fee numeric NOT NULL,
    influencer_payout numeric NOT NULL,
    call_status call_status DEFAULT 'pending'::call_status,
    video_call_room_id character varying(255),
    daily_room_name character varying(255),
    daily_room_url text,
    daily_room_created_at timestamp with time zone,
    call_started_at timestamp with time zone,
    call_ended_at timestamp with time zone,
    influencer_joined_at timestamp with time zone,
    fan_joined_at timestamp with time zone,
    call_actual_duration_minutes integer,
    purchased_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- bidsテーブル
CREATE TABLE bids (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    auction_id uuid NOT NULL,
    user_id uuid NOT NULL,
    bid_amount numeric NOT NULL,
    is_autobid boolean DEFAULT false,
    stripe_payment_intent_id character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- call_logsテーブル
CREATE TABLE call_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    purchased_slot_id uuid NOT NULL,
    user_id uuid,
    event_type character varying(50) NOT NULL,
    participant_type character varying(20),
    data jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- daily_call_eventsテーブル
CREATE TABLE daily_call_events (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    purchased_slot_id uuid NOT NULL,
    event_type daily_event_type NOT NULL,
    user_id uuid,
    participant_id character varying(255),
    event_data jsonb,
    room_end_reason character varying(50),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- followsテーブル
CREATE TABLE follows (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    follower_id uuid NOT NULL,
    following_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- notificationsテーブル
CREATE TABLE notifications (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    type character varying(50) NOT NULL,
    title character varying(200) NOT NULL,
    message text NOT NULL,
    related_entity_type character varying(50),
    related_entity_id uuid,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- payment_transactionsテーブル
CREATE TABLE payment_transactions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    purchased_slot_id uuid NOT NULL,
    stripe_payment_intent_id character varying(255) NOT NULL,
    stripe_charge_id character varying(255),
    stripe_transfer_id character varying(255),
    amount numeric NOT NULL,
    platform_fee numeric NOT NULL,
    influencer_payout numeric NOT NULL,
    status payment_status DEFAULT 'pending'::payment_status,
    error_message text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- reviewsテーブル
CREATE TABLE reviews (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    purchased_slot_id uuid NOT NULL,
    fan_user_id uuid NOT NULL,
    influencer_user_id uuid NOT NULL,
    rating integer NOT NULL,
    comment text,
    is_public boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PRIMARY KEY制約の追加
-- ============================================

ALTER TABLE ONLY auctions ADD CONSTRAINT auctions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY bids ADD CONSTRAINT bids_pkey PRIMARY KEY (id);
ALTER TABLE ONLY call_logs ADD CONSTRAINT call_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY call_slots ADD CONSTRAINT call_slots_pkey PRIMARY KEY (id);
ALTER TABLE ONLY daily_call_events ADD CONSTRAINT daily_call_events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY follows ADD CONSTRAINT follows_pkey PRIMARY KEY (id);
ALTER TABLE ONLY notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE ONLY payment_transactions ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY purchased_slots ADD CONSTRAINT purchased_slots_pkey PRIMARY KEY (id);
ALTER TABLE ONLY reviews ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);
ALTER TABLE ONLY users ADD CONSTRAINT users_pkey PRIMARY KEY (id);

-- ============================================
-- UNIQUE制約の追加
-- ============================================

ALTER TABLE ONLY auctions ADD CONSTRAINT auctions_call_slot_id_key UNIQUE (call_slot_id);
ALTER TABLE ONLY follows ADD CONSTRAINT follows_follower_id_following_id_key UNIQUE (follower_id, following_id);
ALTER TABLE ONLY payment_transactions ADD CONSTRAINT payment_transactions_stripe_charge_id_key UNIQUE (stripe_charge_id);
ALTER TABLE ONLY payment_transactions ADD CONSTRAINT payment_transactions_stripe_payment_intent_id_key UNIQUE (stripe_payment_intent_id);
ALTER TABLE ONLY purchased_slots ADD CONSTRAINT purchased_slots_call_slot_id_key UNIQUE (call_slot_id);
ALTER TABLE ONLY reviews ADD CONSTRAINT reviews_purchased_slot_id_key UNIQUE (purchased_slot_id);
ALTER TABLE ONLY users ADD CONSTRAINT users_auth_user_id_key UNIQUE (auth_user_id);
ALTER TABLE ONLY users ADD CONSTRAINT users_stripe_account_id_key UNIQUE (stripe_account_id);
ALTER TABLE ONLY users ADD CONSTRAINT users_stripe_customer_id_key UNIQUE (stripe_customer_id);

-- ============================================
-- FOREIGN KEY制約の追加
-- ============================================

-- auctionsテーブル
ALTER TABLE ONLY auctions ADD CONSTRAINT auctions_call_slot_id_fkey FOREIGN KEY (call_slot_id) REFERENCES call_slots(id);
ALTER TABLE ONLY auctions ADD CONSTRAINT auctions_current_winner_id_fkey FOREIGN KEY (current_winner_id) REFERENCES users(id);

-- bidsテーブル
ALTER TABLE ONLY bids ADD CONSTRAINT bids_auction_id_fkey FOREIGN KEY (auction_id) REFERENCES auctions(id);
ALTER TABLE ONLY bids ADD CONSTRAINT bids_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);

-- call_logsテーブル
ALTER TABLE ONLY call_logs ADD CONSTRAINT call_logs_purchased_slot_id_fkey FOREIGN KEY (purchased_slot_id) REFERENCES purchased_slots(id);
ALTER TABLE ONLY call_logs ADD CONSTRAINT call_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);

-- call_slotsテーブル
ALTER TABLE ONLY call_slots ADD CONSTRAINT call_slots_fan_user_id_fkey FOREIGN KEY (fan_user_id) REFERENCES users(id);
ALTER TABLE ONLY call_slots ADD CONSTRAINT call_slots_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);

-- daily_call_eventsテーブル
ALTER TABLE ONLY daily_call_events ADD CONSTRAINT daily_call_events_purchased_slot_id_fkey FOREIGN KEY (purchased_slot_id) REFERENCES purchased_slots(id);
ALTER TABLE ONLY daily_call_events ADD CONSTRAINT daily_call_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);

-- followsテーブル
ALTER TABLE ONLY follows ADD CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES users(id);
ALTER TABLE ONLY follows ADD CONSTRAINT follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES users(id);

-- notificationsテーブル
ALTER TABLE ONLY notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);

-- payment_transactionsテーブル
ALTER TABLE ONLY payment_transactions ADD CONSTRAINT payment_transactions_purchased_slot_id_fkey FOREIGN KEY (purchased_slot_id) REFERENCES purchased_slots(id);

-- purchased_slotsテーブル
ALTER TABLE ONLY purchased_slots ADD CONSTRAINT purchased_slots_auction_id_fkey FOREIGN KEY (auction_id) REFERENCES auctions(id);
ALTER TABLE ONLY purchased_slots ADD CONSTRAINT purchased_slots_call_slot_id_fkey FOREIGN KEY (call_slot_id) REFERENCES call_slots(id);
ALTER TABLE ONLY purchased_slots ADD CONSTRAINT purchased_slots_fan_user_id_fkey FOREIGN KEY (fan_user_id) REFERENCES users(id);
ALTER TABLE ONLY purchased_slots ADD CONSTRAINT purchased_slots_influencer_user_id_fkey FOREIGN KEY (influencer_user_id) REFERENCES users(id);

-- reviewsテーブル
ALTER TABLE ONLY reviews ADD CONSTRAINT reviews_fan_user_id_fkey FOREIGN KEY (fan_user_id) REFERENCES users(id);
ALTER TABLE ONLY reviews ADD CONSTRAINT reviews_influencer_user_id_fkey FOREIGN KEY (influencer_user_id) REFERENCES users(id);
ALTER TABLE ONLY reviews ADD CONSTRAINT reviews_purchased_slot_id_fkey FOREIGN KEY (purchased_slot_id) REFERENCES purchased_slots(id);

-- usersテーブル（auth.usersへの参照）
ALTER TABLE ONLY users ADD CONSTRAINT users_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id);

-- ============================================
-- インデックスの作成
-- ============================================

-- auctionsテーブルのインデックス
CREATE INDEX idx_auctions_call_slot ON auctions USING btree (call_slot_id);
CREATE INDEX idx_auctions_end_time ON auctions USING btree (end_time) WHERE (status = ANY (ARRAY['scheduled'::auction_status, 'active'::auction_status]));
CREATE INDEX idx_auctions_status ON auctions USING btree (status);

-- bidsテーブルのインデックス
CREATE INDEX idx_bids_amount ON bids USING btree (auction_id, bid_amount DESC);
CREATE INDEX idx_bids_auction_created ON bids USING btree (auction_id, created_at DESC);
CREATE INDEX idx_bids_user ON bids USING btree (user_id);

-- call_logsテーブルのインデックス
CREATE INDEX idx_call_logs_event ON call_logs USING btree (event_type, created_at);
CREATE INDEX idx_call_logs_slot ON call_logs USING btree (purchased_slot_id);
CREATE INDEX idx_call_logs_user_id ON call_logs USING btree (user_id);

-- call_slotsテーブルのインデックス
CREATE INDEX idx_call_slots_end_time ON call_slots USING btree (end_time);
CREATE INDEX idx_call_slots_fan_user ON call_slots USING btree (fan_user_id);
CREATE INDEX idx_call_slots_published ON call_slots USING btree (is_published, scheduled_start_time);
CREATE INDEX idx_call_slots_scheduled_time ON call_slots USING btree (scheduled_start_time);
CREATE INDEX idx_call_slots_status ON call_slots USING btree (status);
CREATE INDEX idx_call_slots_user ON call_slots USING btree (user_id);

-- daily_call_eventsテーブルのインデックス
CREATE INDEX idx_daily_events_slot ON daily_call_events USING btree (purchased_slot_id);
CREATE INDEX idx_daily_events_type ON daily_call_events USING btree (event_type);
CREATE INDEX idx_daily_events_user ON daily_call_events USING btree (user_id);

-- followsテーブルのインデックス
CREATE INDEX idx_follows_created_at ON follows USING btree (created_at DESC);
CREATE INDEX idx_follows_follower_id ON follows USING btree (follower_id);
CREATE INDEX idx_follows_following_id ON follows USING btree (following_id);

-- notificationsテーブルのインデックス
CREATE INDEX idx_notifications_user ON notifications USING btree (user_id, is_read, created_at DESC);

-- purchased_slotsテーブルのインデックス
CREATE INDEX idx_purchased_slots_call_time ON purchased_slots USING btree (call_started_at, call_status);
CREATE INDEX idx_purchased_slots_daily_room ON purchased_slots USING btree (daily_room_name);
CREATE INDEX idx_purchased_slots_fan ON purchased_slots USING btree (fan_user_id);
CREATE INDEX idx_purchased_slots_influencer ON purchased_slots USING btree (influencer_user_id);
CREATE INDEX idx_purchased_slots_status ON purchased_slots USING btree (call_status);

-- usersテーブルのインデックス
CREATE INDEX idx_users_auth_user ON users USING btree (auth_user_id);
CREATE INDEX idx_users_is_fan ON users USING btree (is_fan) WHERE (is_fan = true);
CREATE INDEX idx_users_is_influencer ON users USING btree (is_influencer) WHERE (is_influencer = true);
CREATE INDEX idx_users_stripe_account ON users USING btree (stripe_account_id);
CREATE INDEX idx_users_stripe_connect_account_id ON users USING btree (stripe_connect_account_id);
CREATE INDEX idx_users_stripe_customer ON users USING btree (stripe_customer_id);
