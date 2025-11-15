-- ============================================
-- call_slotsテーブルのRLSポリシーの無限再帰を修正
-- usersテーブルを直接参照する代わりに、SECURITY DEFINER関数を使用
-- ============================================

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Fans can view their purchased call slots" ON call_slots;
DROP POLICY IF EXISTS "Influencers can manage their own call slots" ON call_slots;

-- ファンが購入したcall_slotsを閲覧できるポリシーを再作成
-- get_current_user_id()関数を使用して無限再帰を防ぐ
CREATE POLICY "Fans can view their purchased call slots" 
  ON call_slots FOR SELECT 
  USING (
    fan_user_id = get_current_user_id()
    AND fan_user_id IS NOT NULL
  );

-- インフルエンサーが自分のcall_slotsを管理できるポリシーを再作成
-- get_current_user_id()とis_current_user_influencer()関数を使用して無限再帰を防ぐ
CREATE POLICY "Influencers can manage their own call slots" 
  ON call_slots FOR ALL 
  USING (
    is_current_user_influencer()
    AND user_id = get_current_user_id()
  )
  WITH CHECK (
    is_current_user_influencer()
    AND user_id = get_current_user_id()
  );

