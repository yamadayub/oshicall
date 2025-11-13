-- ============================================
-- 無限再帰を引き起こすRLSポリシーを削除
-- ============================================

-- 無限再帰を引き起こすポリシーを削除
DROP POLICY IF EXISTS "Influencers can view fans who purchased their slots" ON users;

-- セキュリティ定義関数も削除（不要になったため）
DROP FUNCTION IF EXISTS get_current_user_id();
DROP FUNCTION IF EXISTS is_current_user_influencer();

