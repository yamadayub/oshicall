-- =========================================
-- オークション終了済みだがpurchased_slotsが作成されていない場合の手動修正SQL
-- =========================================
-- このSQLは、オークションが終了しているがpurchased_slotsが存在しない場合に使用します
-- =========================================

-- 1. 修正対象のオークションを確認
--    (オークション終了済み、最高入札あり、purchased_slots未作成)
SELECT 
  a.id as auction_id,
  a.call_slot_id,
  a.status as auction_status,
  a.current_winner_id,
  a.current_highest_bid,
  a.end_time,
  cs.title as call_slot_title,
  cs.user_id as influencer_user_id,
  cs.fan_user_id as call_slot_fan_user_id,
  b.id as bid_id,
  b.user_id as bid_user_id,
  b.bid_amount,
  b.stripe_payment_intent_id,
  ps.id as purchased_slot_id
FROM auctions a
LEFT JOIN call_slots cs ON a.call_slot_id = cs.id
LEFT JOIN bids b ON a.id = b.auction_id AND b.bid_amount = a.current_highest_bid
LEFT JOIN purchased_slots ps ON a.id = ps.auction_id
WHERE a.status = 'ended'
  AND a.current_winner_id IS NOT NULL
  AND a.current_highest_bid IS NOT NULL
  AND ps.id IS NULL  -- purchased_slotsが存在しない
  AND b.id IS NOT NULL  -- 最高入札が存在する
ORDER BY a.end_time DESC;

-- 2. 特定のauction_idに対してpurchased_slotsを手動で作成
--    以下の変数を実際の値に置き換えて実行してください:
--    - :auction_id: オークションID
--    - :call_slot_id: call_slotsのID
--    - :fan_user_id: 落札者のユーザーID
--    - :influencer_user_id: インフルエンサーのユーザーID
--    - :winning_bid_amount: 落札金額
--    注意: stripe_payment_intent_idはpurchased_slotsテーブルには保存されません
--          payment_transactionsテーブルに保存されます

-- 例: auction_id = '0a054d07-941a-4ba6-80c7-bd7fdd882fbc' の場合
-- まず、必要な情報を取得
WITH auction_info AS (
  SELECT 
    a.id as auction_id,
    a.call_slot_id,
    a.current_winner_id as fan_user_id,
    a.current_highest_bid as winning_bid_amount,
    cs.user_id as influencer_user_id,
    ROUND(a.current_highest_bid * 0.2) as platform_fee,
    ROUND(a.current_highest_bid * 0.8) as influencer_payout
  FROM auctions a
  LEFT JOIN call_slots cs ON a.call_slot_id = cs.id
  WHERE a.id = '0a054d07-941a-4ba6-80c7-bd7fdd882fbc'  -- ここにauction_idを指定
    AND a.status = 'ended'
    AND a.current_winner_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM purchased_slots ps WHERE ps.auction_id = a.id
    )
)
-- purchased_slotsを作成
INSERT INTO purchased_slots (
  call_slot_id,
  fan_user_id,
  influencer_user_id,
  auction_id,
  winning_bid_amount,
  platform_fee,
  influencer_payout,
  call_status,
  purchased_at
)
SELECT 
  call_slot_id,
  fan_user_id,
  influencer_user_id,
  auction_id,
  winning_bid_amount,
  platform_fee,
  influencer_payout,
  'pending' as call_status,
  NOW() as purchased_at
FROM auction_info
RETURNING *;

-- 3. call_slotsテーブルのfan_user_idも更新（念のため）
UPDATE call_slots
SET fan_user_id = (
  SELECT current_winner_id 
  FROM auctions 
  WHERE auctions.call_slot_id = call_slots.id 
    AND auctions.id = '0a054d07-941a-4ba6-80c7-bd7fdd882fbc'  -- ここにauction_idを指定
)
WHERE id = (
  SELECT call_slot_id 
  FROM auctions 
  WHERE auctions.id = '0a054d07-941a-4ba6-80c7-bd7fdd882fbc'  -- ここにauction_idを指定
)
AND fan_user_id IS NULL;  -- 既に設定されている場合は更新しない

-- 4. 作成結果を確認
SELECT 
  ps.id as purchased_slot_id,
  ps.call_slot_id,
  ps.auction_id,
  ps.fan_user_id,
  ps.influencer_user_id,
  ps.winning_bid_amount,
  ps.call_status,
  ps.purchased_at,
  cs.title as call_slot_title
FROM purchased_slots ps
LEFT JOIN call_slots cs ON ps.call_slot_id = cs.id
WHERE ps.auction_id = '0a054d07-941a-4ba6-80c7-bd7fdd882fbc';  -- ここにauction_idを指定

-- =========================================
-- 完了
-- =========================================
-- このSQLを実行後、以下を確認してください:
-- 1. purchased_slotsが正しく作成されたか
-- 2. call_slots.fan_user_idが正しく更新されたか
-- 3. フロントエンドでTalk枠が表示されるか
-- =========================================

