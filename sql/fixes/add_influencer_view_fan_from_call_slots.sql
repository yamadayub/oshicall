-- ============================================
-- インフルエンサーが自分のTalk枠に落札したfanの情報を閲覧できるRLSポリシーを追加
-- call_slots.fan_user_idを使用して直接usersテーブルから取得できるようにする
-- ============================================

-- 既存のポリシーを削除（無限再帰を防ぐため）
DROP POLICY IF EXISTS "Influencers can view fans from their call slots" ON users;

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

-- インフルエンサーが自分のTalk枠に落札したfanのプロフィールを閲覧可能にする
-- call_slotsテーブルを経由して、自分のuser_idで作成されたcall_slotsのfan_user_idに一致するユーザーを閲覧可能
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

