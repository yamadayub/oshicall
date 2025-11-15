-- ============================================
-- auctionsテーブルのRLSポリシーの無限再帰を修正
-- usersテーブルを直接参照する代わりに、SECURITY DEFINER関数を使用
-- ============================================

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Influencers can update their auction end time" ON auctions;
DROP POLICY IF EXISTS "Influencers can update their auctions" ON auctions;

-- インフルエンサーが自分のauctionsを更新できるポリシーを再作成
-- get_current_user_id()とis_current_user_influencer()関数を使用して無限再帰を防ぐ
CREATE POLICY "Influencers can update their auctions" 
  ON auctions FOR UPDATE 
  USING (
    is_current_user_influencer()
    AND EXISTS (
      SELECT 1 FROM call_slots cs
      WHERE cs.id = auctions.call_slot_id
        AND cs.user_id = get_current_user_id()
    )
  )
  WITH CHECK (
    is_current_user_influencer()
    AND EXISTS (
      SELECT 1 FROM call_slots cs
      WHERE cs.id = auctions.call_slot_id
        AND cs.user_id = get_current_user_id()
    )
  );

-- インフルエンサーが自分のauctionsの終了時間を更新できるポリシーを再作成
CREATE POLICY "Influencers can update their auction end time" 
  ON auctions FOR UPDATE 
  USING (
    is_current_user_influencer()
    AND EXISTS (
      SELECT 1 FROM call_slots cs
      WHERE cs.id = auctions.call_slot_id
        AND cs.user_id = get_current_user_id()
    )
  )
  WITH CHECK (
    is_current_user_influencer()
    AND EXISTS (
      SELECT 1 FROM call_slots cs
      WHERE cs.id = auctions.call_slot_id
        AND cs.user_id = get_current_user_id()
    )
  );

