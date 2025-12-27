-- =========================================
-- 特定のTalk枠のpurchased_slotsを確認
-- =========================================
-- 使用方法: talkIdを置き換えて実行
-- =========================================

-- 1. 特定のcall_slot_idに対応するpurchased_slotsを確認
SELECT 
  ps.id as purchased_slot_id,
  ps.call_slot_id,
  ps.auction_id,
  ps.fan_user_id,
  ps.influencer_user_id,
  ps.winning_bid_amount,
  ps.call_status,
  ps.purchased_at,
  cs.title as call_slot_title,
  cs.user_id as call_slot_user_id,
  cs.fan_user_id as call_slot_fan_user_id,
  a.status as auction_status,
  a.current_winner_id,
  fan.display_name as fan_name,
  influencer.display_name as influencer_name
FROM purchased_slots ps
LEFT JOIN call_slots cs ON ps.call_slot_id = cs.id
LEFT JOIN auctions a ON ps.auction_id = a.id
LEFT JOIN users fan ON ps.fan_user_id = fan.id
LEFT JOIN users influencer ON ps.influencer_user_id = influencer.id
WHERE ps.call_slot_id = '85a47898-0f4b-44db-ba2c-683348fc97d5' -- ここにtalkIdを指定
ORDER BY ps.purchased_at DESC;

-- 2. 特定のcall_slot_idに対応するauctionsを確認
SELECT 
  a.id as auction_id,
  a.call_slot_id,
  a.status as auction_status,
  a.current_winner_id,
  a.current_highest_bid,
  a.end_time,
  cs.title as call_slot_title,
  cs.user_id as call_slot_user_id,
  cs.fan_user_id as call_slot_fan_user_id
FROM auctions a
LEFT JOIN call_slots cs ON a.call_slot_id = cs.id
WHERE a.call_slot_id = '85a47898-0f4b-44db-ba2c-683348fc97d5' -- ここにtalkIdを指定
ORDER BY a.end_time DESC;

-- 3. 特定のcall_slot_idに対応するbidsを確認（最高入札を確認）
SELECT 
  b.id as bid_id,
  b.auction_id,
  b.user_id,
  b.bid_amount,
  b.created_at,
  u.display_name as bidder_name
FROM bids b
LEFT JOIN users u ON b.user_id = u.id
WHERE b.auction_id IN (
  SELECT id FROM auctions WHERE call_slot_id = '85a47898-0f4b-44db-ba2c-683348fc97d5' -- ここにtalkIdを指定
)
ORDER BY b.bid_amount DESC;

-- 4. purchased_slotsが存在しないが、auctionが終了しているcall_slotsを確認
SELECT 
  cs.id as call_slot_id,
  cs.title,
  cs.user_id as influencer_user_id,
  cs.fan_user_id,
  a.id as auction_id,
  a.status as auction_status,
  a.current_winner_id,
  a.current_highest_bid,
  a.end_time,
  CASE 
    WHEN ps.id IS NULL THEN 'purchased_slotsが存在しない'
    ELSE 'purchased_slotsが存在する'
  END as purchased_slot_status
FROM call_slots cs
INNER JOIN auctions a ON cs.id = a.call_slot_id
LEFT JOIN purchased_slots ps ON cs.id = ps.call_slot_id
WHERE a.status = 'ended'
  AND cs.fan_user_id IS NOT NULL
  AND ps.id IS NULL
ORDER BY a.end_time DESC
LIMIT 10;

-- =========================================
-- 完了
-- =========================================

