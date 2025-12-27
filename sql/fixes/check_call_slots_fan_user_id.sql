-- =========================================
-- call_slots.fan_user_idの確認（最重要）
-- =========================================
-- オークションID: 0a054d07-941a-4ba6-80c7-bd7fdd882fbc
-- call_slot_id: 85a47898-0f4b-44db-ba2c-683348fc97d5
-- =========================================

-- call_slotsのfan_user_idを直接確認
SELECT 
  cs.id as call_slot_id,
  cs.fan_user_id,
  cs.user_id as influencer_user_id,
  cs.deleted_at,
  -- 期待値との比較
  CASE 
    WHEN cs.fan_user_id = '484fff05-d056-45ce-a4ca-a6b1988a23c9' THEN '✅ fan_user_id一致'
    WHEN cs.fan_user_id IS NULL THEN '❌ fan_user_id未設定（NULL）'
    ELSE '❌ fan_user_id不一致（実際の値: ' || cs.fan_user_id::text || '）'
  END as fan_user_id_check,
  -- getPurchasedTalks()で取得できるか
  CASE 
    WHEN cs.fan_user_id = '484fff05-d056-45ce-a4ca-a6b1988a23c9' 
         AND cs.deleted_at IS NULL 
    THEN '✅ getPurchasedTalks()で取得可能'
    WHEN cs.fan_user_id IS NULL 
    THEN '❌ getPurchasedTalks()で取得不可（fan_user_id未設定）'
    WHEN cs.fan_user_id != '484fff05-d056-45ce-a4ca-a6b1988a23c9' 
    THEN '❌ getPurchasedTalks()で取得不可（fan_user_id不一致）'
    WHEN cs.deleted_at IS NOT NULL 
    THEN '❌ getPurchasedTalks()で取得不可（削除済み）'
    ELSE '❌ getPurchasedTalks()で取得不可（その他）'
  END as query_result
FROM call_slots cs
WHERE cs.id = '85a47898-0f4b-44db-ba2c-683348fc97d5';

-- purchased_slotsとの比較
SELECT 
  'call_slots' as source,
  cs.fan_user_id,
  cs.id as call_slot_id
FROM call_slots cs
WHERE cs.id = '85a47898-0f4b-44db-ba2c-683348fc97d5'

UNION ALL

SELECT 
  'purchased_slots' as source,
  ps.fan_user_id,
  ps.call_slot_id
FROM purchased_slots ps
WHERE ps.auction_id = '0a054d07-941a-4ba6-80c7-bd7fdd882fbc';

-- =========================================
-- 完了
-- =========================================
-- このSQLを実行後、以下を確認してください:
-- 1. call_slots.fan_user_idが'484fff05-d056-45ce-a4ca-a6b1988a23c9'に設定されているか
-- 2. purchased_slots.fan_user_idと一致しているか
-- =========================================

