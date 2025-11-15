-- ============================================
-- RLSポリシーの無限再帰を修正
-- SECURITY DEFINER関数内でSET LOCAL row_security = offを使用してRLSをバイパス
-- ============================================

-- 既存のポリシーを削除（関数に依存しているため先に削除）
DROP POLICY IF EXISTS "Influencers can view fans from their call slots" ON users;

-- 既存の関数を削除
DROP FUNCTION IF EXISTS get_current_user_id();
DROP FUNCTION IF EXISTS is_current_user_influencer();

-- セキュリティ定義関数を作成（RLSポリシー内でusersテーブルを参照する際の無限再帰を防ぐ）
-- SECURITY DEFINER + SET LOCAL row_security = off により、RLSポリシーをバイパスしてusersテーブルにアクセス可能
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- インフルエンサーかどうかを判定するセキュリティ定義関数
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ポリシーを再作成
CREATE POLICY "Influencers can view fans from their call slots" 
  ON users FOR SELECT 
  USING (
    is_current_user_influencer()
    AND EXISTS (
      SELECT 1 FROM call_slots cs
      WHERE cs.fan_user_id = users.id
        AND cs.user_id = get_current_user_id()
        AND cs.fan_user_id IS NOT NULL
    )
  );

