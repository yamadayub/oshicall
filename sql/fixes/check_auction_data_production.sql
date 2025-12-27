-- =========================================
-- Production環境でのオークションID: 0a054d07-941a-4ba6-80c7-bd7fdd882fbc のデータ確認
-- =========================================
-- Supabase DashboardのSQL Editorで実行してください
-- =========================================

-- 1. auctionsテーブルの状態
SELECT 
  a.id as auction_id,
  a.call_slot_id,
  a.status as auction_status,
  a.start_time,
  a.end_time,
  a.current_highest_bid,
  a.current_winner_id,
  a.total_bids_count,
  a.created_at,
  a.updated_at,
  CASE 
    WHEN a.status = 'ended' THEN '✅ オークション終了済み'
    WHEN a.status = 'active' THEN '⚠️ オークション進行中'
    ELSE '❓ その他のステータス'
  END as status_check
FROM auctions a
WHERE a.id = '0a054d07-941a-4ba6-80c7-bd7fdd882fbc';

-- 2. call_slotsテーブルの状態
SELECT 
  cs.id as call_slot_id,
  cs.user_id as influencer_user_id,
  cs.fan_user_id,
  cs.title,
  cs.scheduled_start_time,
  cs.duration_minutes,
  cs.is_published,
  cs.deleted_at,
  CASE 
    WHEN cs.fan_user_id IS NOT NULL THEN '✅ fan_user_id設定済み'
    ELSE '❌ fan_user_id未設定'
  END as fan_user_id_check
FROM call_slots cs
WHERE cs.id = (
  SELECT call_slot_id 
  FROM auctions 
  WHERE id = '0a054d07-941a-4ba6-80c7-bd7fdd882fbc'
);

-- 3. bidsテーブル（このオークションの全入札、最高入札を確認）
SELECT 
  b.id as bid_id,
  b.auction_id,
  b.user_id,
  b.bid_amount,
  b.stripe_payment_intent_id,
  b.is_autobid,
  b.created_at,
  u.display_name as bidder_name,
  CASE 
    WHEN b.stripe_payment_intent_id IS NOT NULL THEN '✅ PaymentIntentあり'
    ELSE '❌ PaymentIntentなし'
  END as payment_intent_check,
  CASE 
    WHEN b.bid_amount = (
      SELECT MAX(bid_amount) FROM bids WHERE auction_id = b.auction_id
    ) THEN '🏆 最高入札'
    ELSE ''
  END as is_highest_bid
FROM bids b
LEFT JOIN users u ON b.user_id = u.id
WHERE b.auction_id = '0a054d07-941a-4ba6-80c7-bd7fdd882fbc'
ORDER BY b.bid_amount DESC, b.created_at DESC;

-- 4. purchased_slotsテーブル（このオークションに関連するもの）
SELECT 
  ps.id as purchased_slot_id,
  ps.call_slot_id,
  ps.auction_id,
  ps.fan_user_id,
  ps.influencer_user_id,
  ps.winning_bid_amount,
  ps.platform_fee,
  ps.influencer_payout,
  ps.call_status,
  ps.purchased_at,
  CASE 
    WHEN ps.id IS NOT NULL THEN '✅ purchased_slots作成済み'
    ELSE '❌ purchased_slots未作成'
  END as purchased_slots_check
FROM purchased_slots ps
WHERE ps.auction_id = '0a054d07-941a-4ba6-80c7-bd7fdd882fbc'
   OR ps.call_slot_id = (
     SELECT call_slot_id 
     FROM auctions 
     WHERE id = '0a054d07-941a-4ba6-80c7-bd7fdd882fbc'
   );

-- 5. 統合確認: オークション完了処理が正しく実行されているか
WITH auction_info AS (
  SELECT 
    a.id as auction_id,
    a.call_slot_id,
    a.status as auction_status,
    a.end_time,
    a.current_winner_id,
    a.current_highest_bid
  FROM auctions a
  WHERE a.id = '0a054d07-941a-4ba6-80c7-bd7fdd882fbc'
),
call_slot_info AS (
  SELECT 
    cs.id as call_slot_id,
    cs.fan_user_id,
    cs.user_id as influencer_user_id
  FROM call_slots cs
  WHERE cs.id = (SELECT call_slot_id FROM auction_info)
),
purchased_slot_info AS (
  SELECT 
    ps.id as purchased_slot_id,
    ps.call_slot_id,
    ps.auction_id,
    ps.fan_user_id,
    ps.influencer_user_id,
    ps.call_status
  FROM purchased_slots ps
  WHERE ps.auction_id = '0a054d07-941a-4ba6-80c7-bd7fdd882fbc'
)
SELECT 
  'auctions' as table_name,
  ai.auction_id::text as record_id,
  ai.auction_status::text as status,
  ai.current_winner_id::text as winner_id,
  ai.current_highest_bid::text as highest_bid,
  CASE 
    WHEN ai.auction_status = 'ended' THEN '✅ オークション終了済み'
    ELSE '⚠️ オークション未終了'
  END as check_result
FROM auction_info ai

UNION ALL

SELECT 
  'call_slots' as table_name,
  csi.call_slot_id::text as record_id,
  COALESCE(csi.fan_user_id::text, 'NULL') as status,
  csi.fan_user_id::text as winner_id,
  csi.influencer_user_id::text as highest_bid,
  CASE 
    WHEN csi.fan_user_id IS NOT NULL THEN '✅ fan_user_id設定済み'
    ELSE '❌ fan_user_id未設定'
  END as check_result
FROM call_slot_info csi

UNION ALL

SELECT 
  'purchased_slots' as table_name,
  COALESCE(psi.purchased_slot_id::text, 'NULL') as record_id,
  COALESCE(psi.call_status::text, 'NULL') as status,
  COALESCE(psi.fan_user_id::text, 'NULL') as winner_id,
  COALESCE(psi.influencer_user_id::text, 'NULL') as highest_bid,
  CASE 
    WHEN psi.purchased_slot_id IS NOT NULL THEN '✅ purchased_slots作成済み'
    ELSE '❌ purchased_slots未作成'
  END as check_result
FROM purchased_slot_info psi;

-- 6. finalize-auctionsが処理すべき条件をチェック
SELECT 
  a.id as auction_id,
  a.status,
  a.end_time,
  a.current_winner_id,
  a.current_highest_bid,
  NOW() as current_time,
  CASE 
    WHEN a.status = 'active' AND a.end_time <= NOW() THEN '✅ 処理対象（active + 終了時刻過ぎ）'
    WHEN a.status = 'ended' AND a.end_time <= NOW() AND a.current_winner_id IS NOT NULL AND a.current_highest_bid IS NOT NULL THEN '✅ 処理対象（ended + purchased_slots未作成の可能性）'
    ELSE '❌ 処理対象外'
  END as should_process,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM purchased_slots ps WHERE ps.auction_id = a.id
    ) THEN '✅ purchased_slots存在'
    ELSE '❌ purchased_slots未存在'
  END as purchased_slots_check,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM bids b 
      WHERE b.auction_id = a.id 
      AND b.stripe_payment_intent_id IS NOT NULL
      ORDER BY b.bid_amount DESC LIMIT 1
    ) THEN '✅ PaymentIntentあり'
    ELSE '❌ PaymentIntentなし'
  END as payment_intent_check
FROM auctions a
WHERE a.id = '0a054d07-941a-4ba6-80c7-bd7fdd882fbc';

-- =========================================
-- 完了
-- =========================================
-- このSQLを実行後、以下を確認してください:
-- 1. auctions.statusが'ended'か
-- 2. call_slots.fan_user_idが設定されているか
-- 3. purchased_slotsが作成されているか
-- 4. 最高入札にstripe_payment_intent_idがあるか
-- =========================================

