-- =========================================
-- fan_user_idがNULLのcall_slotsレコードを更新
-- =========================================
-- オークション落札済みだがfan_user_idが設定されていないレコードを修正
-- =========================================

-- ステップ1: 現在の状態を確認
SELECT
  cs.id,
  cs.title,
  cs.fan_user_id,
  ps.fan_user_id as purchased_slots_fan_user_id,
  ps.id as purchased_slot_id
FROM call_slots cs
LEFT JOIN purchased_slots ps ON ps.call_slot_id = cs.id
WHERE cs.fan_user_id IS NULL
  AND ps.id IS NOT NULL;

-- ステップ2: fan_user_idがNULLで、purchased_slotsに対応するレコードがあるものを更新
-- (本来はpurchased_slotsのfan_user_idから取得すべき)
UPDATE call_slots cs
SET fan_user_id = ps.fan_user_id
FROM purchased_slots ps
WHERE ps.call_slot_id = cs.id
  AND cs.fan_user_id IS NULL
  AND ps.fan_user_id IS NOT NULL;

-- ステップ3: それでもNULLのレコードがある場合、指定されたIDで更新
-- (テストデータやマイグレーション漏れの可能性)
UPDATE call_slots
SET fan_user_id = '749d65c2-55e6-4fa5-9c90-762887862a98'
WHERE fan_user_id IS NULL
  AND id IN (
    SELECT cs.id
    FROM call_slots cs
    LEFT JOIN purchased_slots ps ON ps.call_slot_id = cs.id
    WHERE cs.fan_user_id IS NULL
      AND ps.id IS NOT NULL
  );

-- ステップ4: 更新後の確認
SELECT
  cs.id,
  cs.title,
  cs.fan_user_id,
  u.display_name as fan_name
FROM call_slots cs
LEFT JOIN users u ON u.id = cs.fan_user_id
LEFT JOIN purchased_slots ps ON ps.call_slot_id = cs.id
WHERE ps.id IS NOT NULL
ORDER BY cs.scheduled_start_time DESC;

-- =========================================
-- 完了
-- =========================================
