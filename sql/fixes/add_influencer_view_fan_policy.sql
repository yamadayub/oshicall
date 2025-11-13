-- ============================================
-- インフルエンサーが自分のTalkを購入したfanの情報を閲覧できるRLSポリシーを追加
-- ============================================

-- 既存のポリシーを削除（無限再帰を防ぐため）
DROP POLICY IF EXISTS "Influencers can view fans who purchased their slots" ON users;

-- セキュリティ定義関数を作成（RLSポリシー内でusersテーブルを参照する際の無限再帰を防ぐ）
-- SECURITY DEFINERにより、RLSポリシーをバイパスしてusersテーブルにアクセス可能
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
  SELECT id FROM users WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- インフルエンサーかどうかを判定するセキュリティ定義関数
CREATE OR REPLACE FUNCTION is_current_user_influencer()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE auth_user_id = auth.uid() 
      AND is_influencer = TRUE
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- インフルエンサーが自分のTalkを購入したfanのプロフィールを閲覧可能にする
-- セキュリティ定義関数を使用して無限再帰を防ぐ
CREATE POLICY "Influencers can view fans who purchased their slots" 
  ON users FOR SELECT 
  USING (
    is_current_user_influencer()
    AND EXISTS (
      SELECT 1 FROM purchased_slots ps
      WHERE ps.fan_user_id = users.id
        AND ps.influencer_user_id = get_current_user_id()
    )
  );

