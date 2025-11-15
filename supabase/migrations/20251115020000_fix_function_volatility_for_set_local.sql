-- ============================================
-- 関数のvolatilityを修正
-- SET LOCALを使用するため、STABLEからVOLATILEに変更
-- ============================================

-- get_current_user_id関数をVOLATILEに変更
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- RLSを一時的に無効化してusersテーブルにアクセス
  SET LOCAL row_security = off;
  SELECT id INTO v_user_id FROM users WHERE auth_user_id = auth.uid() LIMIT 1;
  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- is_current_user_influencer関数をVOLATILEに変更
CREATE OR REPLACE FUNCTION is_current_user_influencer()
RETURNS BOOLEAN AS $$
DECLARE
  v_is_influencer BOOLEAN;
BEGIN
  -- RLSを一時的に無効化してusersテーブルにアクセス
  SET LOCAL row_security = off;
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE auth_user_id = auth.uid() 
      AND is_influencer = TRUE
  ) INTO v_is_influencer;
  RETURN v_is_influencer;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

