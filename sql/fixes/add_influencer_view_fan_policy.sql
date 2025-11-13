-- ============================================
-- インフルエンサーが自分のTalkを購入したfanの情報を閲覧できるRLSポリシーを追加
-- ============================================

-- インフルエンサーが自分のTalkを購入したfanのプロフィールを閲覧可能にする
CREATE POLICY "Influencers can view fans who purchased their slots" 
  ON users FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM purchased_slots ps
      INNER JOIN call_slots cs ON ps.call_slot_id = cs.id
      INNER JOIN users influencer ON cs.user_id = influencer.id
      WHERE ps.fan_user_id = users.id
        AND influencer.auth_user_id = auth.uid()
        AND influencer.is_influencer = TRUE
    )
  );

