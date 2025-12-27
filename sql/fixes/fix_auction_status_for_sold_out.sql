-- =========================================
-- オークション終了済みTalk枠のステータス修正
-- =========================================
-- 問題: purchased_slotsが存在するが、auctions.statusが'ended'になっていないため、
--       インフルエンサー側のTalkページでSOLD OUTラベルが表示されない
-- =========================================

-- 1. purchased_slotsが存在するが、auctions.statusが'ended'になっていないオークションを確認
SELECT 
  a.id as auction_id,
  a.status as auction_status,
  a.end_time as auction_end_time,
  a.auction_end_time,
  ps.id as purchased_slot_id,
  ps.call_slot_id,
  cs.title as call_slot_title,
  cs.user_id as influencer_user_id,
  ps.fan_user_id,
  ps.purchased_at
FROM auctions a
INNER JOIN purchased_slots ps ON a.id = ps.auction_id
INNER JOIN call_slots cs ON ps.call_slot_id = cs.id
WHERE a.status != 'ended'
  AND ps.purchased_at IS NOT NULL
ORDER BY ps.purchased_at DESC;

-- 2. オークション終了時刻を過ぎているが、auctions.statusが'ended'になっていないオークションを確認
SELECT 
  a.id as auction_id,
  a.status as auction_status,
  a.end_time as auction_end_time,
  a.auction_end_time,
  ps.id as purchased_slot_id,
  ps.call_slot_id,
  cs.title as call_slot_title,
  NOW() as current_time,
  (a.auction_end_time < NOW() OR a.end_time < NOW()) as is_past_end_time
FROM auctions a
INNER JOIN purchased_slots ps ON a.id = ps.auction_id
INNER JOIN call_slots cs ON ps.call_slot_id = cs.id
WHERE a.status != 'ended'
  AND (a.auction_end_time < NOW() OR a.end_time < NOW())
ORDER BY a.end_time DESC;

-- 3. purchased_slotsが存在するオークションのstatusを'ended'に更新
--    （オークション終了時刻を過ぎている、またはpurchased_slotsが存在する場合）
UPDATE auctions
SET status = 'ended',
    updated_at = NOW()
WHERE id IN (
  SELECT DISTINCT a.id
  FROM auctions a
  INNER JOIN purchased_slots ps ON a.id = ps.auction_id
  WHERE a.status != 'ended'
    AND ps.purchased_at IS NOT NULL
);

-- 4. 更新結果を確認
SELECT 
  a.id as auction_id,
  a.status as auction_status,
  a.end_time as auction_end_time,
  ps.id as purchased_slot_id,
  cs.title as call_slot_title,
  a.updated_at
FROM auctions a
INNER JOIN purchased_slots ps ON a.id = ps.auction_id
INNER JOIN call_slots cs ON ps.call_slot_id = cs.id
WHERE a.status = 'ended'
ORDER BY a.updated_at DESC
LIMIT 10;

-- =========================================
-- 完了
-- =========================================
-- このSQLを実行すると、purchased_slotsが存在するオークションのstatusが'ended'に更新されます
-- これにより、インフルエンサー側のTalkページでSOLD OUTラベルが正しく表示されます
-- =========================================

