-- =========================================
-- purchased_slotsの詳細確認
-- =========================================
-- オークションID: 0a054d07-941a-4ba6-80c7-bd7fdd882fbc
-- =========================================

-- 1. purchased_slotsの詳細情報
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
  -- 関連するcall_slots情報
  cs.title as call_slot_title,
  cs.user_id as call_slot_influencer_user_id,
  cs.fan_user_id as call_slot_fan_user_id,
  cs.deleted_at as call_slot_deleted_at,
  -- 整合性チェック
  CASE 
    WHEN ps.fan_user_id = cs.fan_user_id THEN '✅ fan_user_id一致'
    ELSE '❌ fan_user_id不一致'
  END as fan_user_id_consistency,
  CASE 
    WHEN ps.influencer_user_id = cs.user_id THEN '✅ influencer_user_id一致'
    ELSE '❌ influencer_user_id不一致'
  END as influencer_user_id_consistency
FROM purchased_slots ps
LEFT JOIN call_slots cs ON ps.call_slot_id = cs.id
WHERE ps.auction_id = '0a054d07-941a-4ba6-80c7-bd7fdd882fbc';

-- 2. call_slotsの状態確認（重要：getPurchasedTalks()の最初のクエリを再現）
SELECT 
  cs.id as call_slot_id,
  cs.user_id as influencer_user_id,
  cs.fan_user_id,
  cs.title,
  cs.scheduled_start_time,
  cs.duration_minutes,
  cs.deleted_at,
  CASE 
    WHEN cs.deleted_at IS NOT NULL THEN '❌ 削除済み'
    WHEN cs.fan_user_id IS NOT NULL THEN '✅ fan_user_id設定済み'
    ELSE '❌ fan_user_id未設定'
  END as status_check,
  -- getPurchasedTalks()のクエリ条件をチェック
  CASE 
    WHEN cs.fan_user_id = '484fff05-d056-45ce-a4ca-a6b1988a23c9' AND cs.deleted_at IS NULL THEN '✅ getPurchasedTalks()で取得可能'
    WHEN cs.fan_user_id != '484fff05-d056-45ce-a4ca-a6b1988a23c9' THEN '❌ fan_user_id不一致（' || COALESCE(cs.fan_user_id::text, 'NULL') || '）'
    WHEN cs.deleted_at IS NOT NULL THEN '❌ 削除済み'
    ELSE '❌ その他の理由で取得不可'
  END as query_check,
  -- purchased_slotsとの整合性チェック
  ps.fan_user_id as purchased_slot_fan_user_id,
  CASE 
    WHEN cs.fan_user_id = ps.fan_user_id THEN '✅ fan_user_id一致'
    ELSE '❌ fan_user_id不一致（call_slots=' || COALESCE(cs.fan_user_id::text, 'NULL') || ', purchased_slots=' || COALESCE(ps.fan_user_id::text, 'NULL') || '）'
  END as consistency_check
FROM call_slots cs
LEFT JOIN purchased_slots ps ON ps.call_slot_id = cs.id AND ps.auction_id = '0a054d07-941a-4ba6-80c7-bd7fdd882fbc'
WHERE cs.id = (
  SELECT call_slot_id 
  FROM auctions 
  WHERE id = '0a054d07-941a-4ba6-80c7-bd7fdd882fbc'
);

-- 3. purchasedTalks.tsのクエリを再現（ファン視点）
-- getPurchasedTalks()のクエリを完全に再現
-- ステップ1: call_slotsの取得（getPurchasedTalks()の最初のクエリ）
SELECT 
  'ステップ1: call_slots取得' as step,
  cs.id as call_slot_id,
  cs.title,
  cs.fan_user_id,
  cs.deleted_at,
  CASE 
    WHEN cs.fan_user_id = '484fff05-d056-45ce-a4ca-a6b1988a23c9' AND cs.deleted_at IS NULL THEN '✅ 取得される'
    WHEN cs.fan_user_id != '484fff05-d056-45ce-a4ca-a6b1988a23c9' THEN '❌ fan_user_id不一致で取得されない'
    WHEN cs.deleted_at IS NOT NULL THEN '❌ 削除済みで取得されない'
    ELSE '❌ その他の理由で取得されない'
  END as query_result
FROM call_slots cs
WHERE cs.fan_user_id = '484fff05-d056-45ce-a4ca-a6b1988a23c9'
  AND cs.deleted_at IS NULL
  AND cs.id = (
    SELECT call_slot_id 
    FROM auctions 
    WHERE id = '0a054d07-941a-4ba6-80c7-bd7fdd882fbc'
  );

-- ステップ2: purchased_slotsの取得（getPurchasedTalks()の2番目のクエリ）
SELECT 
  'ステップ2: purchased_slots取得' as step,
  ps.id as purchased_slot_id,
  ps.call_slot_id,
  ps.fan_user_id,
  ps.call_status,
  CASE 
    WHEN ps.fan_user_id = '484fff05-d056-45ce-a4ca-a6b1988a23c9' THEN '✅ 取得される'
    ELSE '❌ fan_user_id不一致で取得されない'
  END as query_result
FROM purchased_slots ps
WHERE ps.call_slot_id = (
  SELECT call_slot_id 
  FROM auctions 
  WHERE id = '0a054d07-941a-4ba6-80c7-bd7fdd882fbc'
)
  AND ps.fan_user_id = '484fff05-d056-45ce-a4ca-a6b1988a23c9';

-- ステップ3: マッピングの確認
SELECT 
  'ステップ3: マッピング確認' as step,
  cs.id as call_slot_id,
  ps.id as purchased_slot_id,
  CASE 
    WHEN ps.id IS NOT NULL THEN '✅ マッピング成功'
    ELSE '❌ マッピング失敗（purchased_slotが見つからない）'
  END as mapping_result
FROM call_slots cs
LEFT JOIN purchased_slots ps ON cs.id = ps.call_slot_id AND ps.fan_user_id = '484fff05-d056-45ce-a4ca-a6b1988a23c9'
WHERE cs.id = (
  SELECT call_slot_id 
  FROM auctions 
  WHERE id = '0a054d07-941a-4ba6-80c7-bd7fdd882fbc'
);

-- 4. purchasedTalks.tsのクエリを再現（インフルエンサー視点）
-- getInfluencerHostedTalks()のクエリを再現
SELECT 
  cs.id as call_slot_id,
  cs.user_id as influencer_user_id,
  cs.fan_user_id,
  cs.title,
  ps.id as purchased_slot_id,
  ps.fan_user_id as purchased_slot_fan_user_id,
  ps.influencer_user_id as purchased_slot_influencer_user_id,
  ps.call_status,
  -- チェック
  CASE 
    WHEN cs.user_id = ps.influencer_user_id THEN '✅ influencer_user_id一致'
    ELSE '❌ influencer_user_id不一致'
  END as influencer_user_id_match,
  CASE 
    WHEN ps.id IS NOT NULL THEN '✅ purchased_slot存在'
    ELSE '❌ purchased_slot未存在'
  END as purchased_slot_check
FROM call_slots cs
LEFT JOIN purchased_slots ps ON cs.id = ps.call_slot_id AND ps.influencer_user_id = cs.user_id
WHERE cs.user_id = (
  SELECT user_id 
  FROM call_slots 
  WHERE id = (
    SELECT call_slot_id 
    FROM auctions 
    WHERE id = '0a054d07-941a-4ba6-80c7-bd7fdd882fbc'
  )
)
  AND cs.deleted_at IS NULL
  AND cs.id = (
    SELECT call_slot_id 
    FROM auctions 
    WHERE id = '0a054d07-941a-4ba6-80c7-bd7fdd882fbc'
  );

-- 5. RLS（Row Level Security）の影響を確認
-- ユーザーID: 484fff05-d056-45ce-a4ca-a6b1988a23c9 としてpurchased_slotsにアクセスできるか
-- （このクエリはRLSが適用された状態で実行される）
SELECT 
  ps.id as purchased_slot_id,
  ps.call_slot_id,
  ps.fan_user_id,
  ps.influencer_user_id,
  ps.call_status,
  '✅ RLS通過' as rls_check
FROM purchased_slots ps
WHERE ps.call_slot_id = (
  SELECT call_slot_id 
  FROM auctions 
  WHERE id = '0a054d07-941a-4ba6-80c7-bd7fdd882fbc'
)
  AND (ps.fan_user_id = '484fff05-d056-45ce-a4ca-a6b1988a23c9'
    OR ps.influencer_user_id = (
      SELECT user_id 
      FROM call_slots 
      WHERE id = (
        SELECT call_slot_id 
        FROM auctions 
        WHERE id = '0a054d07-941a-4ba6-80c7-bd7fdd882fbc'
      )
    )
  );

-- =========================================
-- 完了
-- =========================================
-- このSQLを実行後、以下を確認してください:
-- 1. purchased_slotsのfan_user_idとcall_slots.fan_user_idが一致しているか
-- 2. purchasedTalks.tsのクエリが正しく動作するか
-- 3. RLSがpurchased_slotsへのアクセスをブロックしていないか
-- =========================================

