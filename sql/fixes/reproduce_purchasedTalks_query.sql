-- =========================================
-- purchasedTalks.tsのgetPurchasedTalks()クエリを完全再現
-- =========================================
-- ユーザーID: 484fff05-d056-45ce-a4ca-a6b1988a23c9
-- =========================================

-- ステップ1: getPurchasedTalks()の最初のクエリ（call_slots取得）
-- このクエリが成功すれば、call_slotsが取得される
SELECT 
  'ステップ1: call_slots取得' as step,
  cs.id as call_slot_id,
  cs.title,
  cs.fan_user_id,
  cs.deleted_at,
  CASE 
    WHEN cs.fan_user_id = '484fff05-d056-45ce-a4ca-a6b1988a23c9' 
         AND cs.deleted_at IS NULL 
    THEN '✅ 取得される'
    WHEN cs.fan_user_id IS NULL 
    THEN '❌ fan_user_id未設定で取得されない'
    WHEN cs.fan_user_id != '484fff05-d056-45ce-a4ca-a6b1988a23c9' 
    THEN '❌ fan_user_id不一致で取得されない（実際の値: ' || COALESCE(cs.fan_user_id::text, 'NULL') || '）'
    WHEN cs.deleted_at IS NOT NULL 
    THEN '❌ 削除済みで取得されない'
    ELSE '❌ その他の理由で取得されない'
  END as query_result
FROM call_slots cs
WHERE cs.fan_user_id = '484fff05-d056-45ce-a4ca-a6b1988a23c9'
  AND cs.deleted_at IS NULL
  AND cs.id = '85a47898-0f4b-44db-ba2c-683348fc97d5';

-- ステップ2: getPurchasedTalks()の2番目のクエリ（purchased_slots取得）
-- call_slot_idのリスト: ['85a47898-0f4b-44db-ba2c-683348fc97d5']
SELECT 
  'ステップ2: purchased_slots取得' as step,
  ps.id as purchased_slot_id,
  ps.call_slot_id,
  ps.fan_user_id,
  ps.call_status,
  CASE 
    WHEN ps.fan_user_id = '484fff05-d056-45ce-a4ca-a6b1988a23c9' 
         AND ps.call_slot_id = '85a47898-0f4b-44db-ba2c-683348fc97d5'
    THEN '✅ 取得される'
    WHEN ps.fan_user_id != '484fff05-d056-45ce-a4ca-a6b1988a23c9' 
    THEN '❌ fan_user_id不一致で取得されない（実際の値: ' || COALESCE(ps.fan_user_id::text, 'NULL') || '）'
    WHEN ps.call_slot_id != '85a47898-0f4b-44db-ba2c-683348fc97d5'
    THEN '❌ call_slot_id不一致で取得されない（実際の値: ' || COALESCE(ps.call_slot_id::text, 'NULL') || '）'
    ELSE '❌ その他の理由で取得されない'
  END as query_result
FROM purchased_slots ps
WHERE ps.call_slot_id IN ('85a47898-0f4b-44db-ba2c-683348fc97d5')
  AND ps.fan_user_id = '484fff05-d056-45ce-a4ca-a6b1988a23c9';

-- ステップ3: マッピングの確認
-- purchasedSlotsMap[callSlot.id]で取得できるか
WITH call_slots_data AS (
  SELECT 
    cs.id as call_slot_id,
    cs.title
  FROM call_slots cs
  WHERE cs.fan_user_id = '484fff05-d056-45ce-a4ca-a6b1988a23c9'
    AND cs.deleted_at IS NULL
    AND cs.id = '85a47898-0f4b-44db-ba2c-683348fc97d5'
),
purchased_slots_data AS (
  SELECT 
    ps.id as purchased_slot_id,
    ps.call_slot_id,
    ps.fan_user_id
  FROM purchased_slots ps
  WHERE ps.call_slot_id IN (SELECT call_slot_id FROM call_slots_data)
    AND ps.fan_user_id = '484fff05-d056-45ce-a4ca-a6b1988a23c9'
)
SELECT 
  'ステップ3: マッピング確認' as step,
  csd.call_slot_id,
  psd.purchased_slot_id,
  CASE 
    WHEN psd.purchased_slot_id IS NOT NULL THEN '✅ マッピング成功（purchasedSlotsMap[callSlot.id]で取得可能）'
    ELSE '❌ マッピング失敗（purchasedSlotsMap[callSlot.id]がundefined）'
  END as mapping_result
FROM call_slots_data csd
LEFT JOIN purchased_slots_data psd ON csd.call_slot_id = psd.call_slot_id;

-- ステップ4: RLS（Row Level Security）の影響を確認
-- フロントエンドからのクエリでRLSが適用された場合の結果
-- 注意: このクエリはRLSが適用されるため、結果が異なる可能性があります
SELECT 
  'ステップ4: RLS確認（フロントエンド視点）' as step,
  ps.id as purchased_slot_id,
  ps.call_slot_id,
  ps.fan_user_id,
  CASE 
    WHEN ps.fan_user_id = '484fff05-d056-45ce-a4ca-a6b1988a23c9' THEN '✅ RLS通過（取得可能）'
    ELSE '❌ RLSブロック（取得不可）'
  END as rls_result
FROM purchased_slots ps
WHERE ps.call_slot_id = '85a47898-0f4b-44db-ba2c-683348fc97d5'
  AND ps.fan_user_id = '484fff05-d056-45ce-a4ca-a6b1988a23c9';

-- =========================================
-- 完了
-- =========================================
-- このSQLを実行後、以下を確認してください:
-- 1. ステップ1でcall_slotsが取得されるか
-- 2. ステップ2でpurchased_slotsが取得されるか
-- 3. ステップ3でマッピングが成功するか
-- 4. ステップ4でRLSが通過するか
-- =========================================

