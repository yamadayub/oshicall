-- ============================================
-- bidsテーブルのRLSポリシーの無限再帰を修正
-- usersテーブルを直接参照する代わりに、SECURITY DEFINER関数を使用
-- ============================================

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Users can view their own bids" ON bids;
DROP POLICY IF EXISTS "Influencers can view bids for their auctions" ON bids;

-- ユーザーが自分の入札を閲覧できるポリシーを再作成
-- get_current_user_id()関数を使用して無限再帰を防ぐ
CREATE POLICY "Users can view their own bids" 
  ON bids FOR SELECT 
  USING (
    user_id = get_current_user_id()
  );

-- インフルエンサーが自分のオークションの入札を閲覧できるポリシーを再作成
-- get_current_user_id()とis_current_user_influencer()関数を使用して無限再帰を防ぐ
CREATE POLICY "Influencers can view bids for their auctions" 
  ON bids FOR SELECT 
  USING (
    is_current_user_influencer()
    AND EXISTS (
      SELECT 1 
      FROM call_slots cs
      JOIN auctions a ON a.call_slot_id = cs.id
      WHERE a.id = bids.auction_id
        AND cs.user_id = get_current_user_id()
    )
  );

