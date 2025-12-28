-- ============================================
-- purchased_slotsテーブルのRLSポリシーを修正
-- get_current_user_id()を使用して統一
-- ============================================

-- 既存のポリシーを削除（コンフリクト回避）
DROP POLICY IF EXISTS "Users can view their own purchased slots" ON purchased_slots;
DROP POLICY IF EXISTS "Influencers can view their sold slots" ON purchased_slots;
DROP POLICY IF EXISTS "Fans can view their purchased slots" ON purchased_slots;
DROP POLICY IF EXISTS "Influencers can view their purchased slots" ON purchased_slots;
DROP POLICY IF EXISTS "Users can view their own purchases" ON purchased_slots;

-- ファンは自分の購入したスロットを閲覧可能
-- fan_user_id (public.users.id) と get_current_user_id() (auth.uid -> public.users.id) を比較
CREATE POLICY "Users can view their own purchased slots"
ON purchased_slots FOR SELECT
USING (
  fan_user_id = get_current_user_id()
);

-- インフルエンサーは自分が販売したスロットを閲覧可能
CREATE POLICY "Influencers can view their sold slots"
ON purchased_slots FOR SELECT
USING (
  influencer_user_id = get_current_user_id()
);

-- インデックスの追加（パフォーマンス向上、既存の場合はスキップ）
CREATE INDEX IF NOT EXISTS idx_purchased_slots_fan_user_id ON purchased_slots(fan_user_id);
CREATE INDEX IF NOT EXISTS idx_purchased_slots_influencer_user_id ON purchased_slots(influencer_user_id);
CREATE INDEX IF NOT EXISTS idx_purchased_slots_call_slot_id ON purchased_slots(call_slot_id);

