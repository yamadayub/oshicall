-- =========================================
-- call_slotsテーブルにfan_user_idカラムを追加
-- =========================================
-- オークション終了後、落札者のuser_idを直接call_slotsに格納
-- これによりJOINなしで落札者情報にアクセス可能
-- =========================================

-- ステップ1: fan_user_idカラムを追加
ALTER TABLE call_slots
ADD COLUMN fan_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- ステップ2: 既存データを移行（purchased_slotsから）
UPDATE call_slots cs
SET fan_user_id = ps.fan_user_id
FROM purchased_slots ps
WHERE ps.call_slot_id = cs.id;

-- ステップ3: インデックスを追加（ファンがログインして自分のcall_slotsを検索するため）
CREATE INDEX idx_call_slots_fan_user ON call_slots(fan_user_id);

-- ステップ4: finalize_auction関数を更新（オークション終了時にfan_user_idを設定）
CREATE OR REPLACE FUNCTION finalize_auction(p_auction_id UUID)
RETURNS TABLE(
  winner_user_id UUID,
  winning_amount DECIMAL,
  call_slot_id UUID
) AS $$
DECLARE
  v_auction RECORD;
BEGIN
  -- オークション情報を取得
  SELECT * INTO v_auction FROM auctions WHERE id = p_auction_id;

  -- 入札がない場合
  IF v_auction.current_winner_id IS NULL THEN
    UPDATE auctions SET status = 'ended' WHERE id = p_auction_id;
    RETURN;
  END IF;

  -- call_slotsにfan_user_idを設定
  UPDATE call_slots
  SET fan_user_id = v_auction.current_winner_id
  WHERE id = v_auction.call_slot_id;

  -- purchased_slotsに記録
  INSERT INTO purchased_slots (
    call_slot_id,
    auction_id,
    fan_user_id,
    influencer_user_id,
    winning_bid_amount,
    platform_fee,
    influencer_payout
  )
  SELECT
    v_auction.call_slot_id,
    v_auction.id,
    v_auction.current_winner_id,
    cs.user_id,
    v_auction.current_highest_bid,
    v_auction.current_highest_bid * 0.20,
    v_auction.current_highest_bid * 0.80
  FROM call_slots cs
  WHERE cs.id = v_auction.call_slot_id;

  -- オークションステータスを終了に
  UPDATE auctions SET status = 'ended' WHERE id = p_auction_id;

  -- 結果を返す
  RETURN QUERY
  SELECT
    v_auction.current_winner_id,
    v_auction.current_highest_bid,
    v_auction.call_slot_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ステップ5: RLSポリシーを更新（ファンが自分のcall_slotsを閲覧できるように）
-- 既存のポリシー「Everyone can view published call slots」があるので、
-- ファンが購入済みのcall_slotsも見れるようにポリシーを追加

CREATE POLICY "Fans can view their purchased call slots"
  ON call_slots FOR SELECT
  USING (
    fan_user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- =========================================
-- 完了
-- =========================================
-- これで以下が可能になります:
-- 1. インフルエンサー: WHERE user_id = ? でcall_slotsを検索
-- 2. ファン: WHERE fan_user_id = ? でcall_slotsを検索
-- 3. JOINなしで落札者情報にアクセス可能
-- =========================================
