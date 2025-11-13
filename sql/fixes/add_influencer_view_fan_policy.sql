-- ============================================
-- インフルエンサーが自分のTalkを購入したfanの情報を閲覧できるRLSポリシーを追加
-- ============================================

-- 既存のポリシーを削除（無限再帰を防ぐため）
DROP POLICY IF EXISTS "Influencers can view fans who purchased their slots" ON users;

-- インフルエンサーが自分のTalkを購入したfanのプロフィールを閲覧可能にする
-- 注意: usersテーブルを参照しないように、purchased_slotsのinfluencer_user_idを使用
CREATE POLICY "Influencers can view fans who purchased their slots" 
  ON users FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM purchased_slots ps
      WHERE ps.fan_user_id = users.id
        AND ps.influencer_user_id IN (
          SELECT id FROM users 
          WHERE auth_user_id = auth.uid() 
            AND is_influencer = TRUE
        )
    )
  );

