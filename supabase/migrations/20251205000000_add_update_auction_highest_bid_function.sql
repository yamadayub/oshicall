-- =========================================
-- update_auction_highest_bid RPC関数の作成/再作成
-- =========================================
-- 入札処理でオークションの最高入札額を更新する関数
-- スキーマキャッシュの問題を解決するため、関数を再作成
-- =========================================

-- 既存の関数を削除（存在する場合）
DROP FUNCTION IF EXISTS public.update_auction_highest_bid(UUID, DECIMAL, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.update_auction_highest_bid(UUID, NUMERIC, UUID) CASCADE;

-- 関数を再作成
CREATE OR REPLACE FUNCTION public.update_auction_highest_bid(
  p_auction_id UUID,
  p_bid_amount NUMERIC,
  p_user_id UUID
)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
  UPDATE auctions
  SET 
    current_highest_bid = p_bid_amount,
    current_winner_id = p_user_id,
    total_bids_count = total_bids_count + 1,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_auction_id;
  
  UPDATE auctions
  SET unique_bidders_count = (
    SELECT COUNT(DISTINCT user_id)
    FROM bids
    WHERE auction_id = p_auction_id
  )
  WHERE id = p_auction_id;
END;
$$;

-- 関数の権限を設定
GRANT EXECUTE ON FUNCTION public.update_auction_highest_bid(UUID, NUMERIC, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_auction_highest_bid(UUID, NUMERIC, UUID) TO anon;

-- 関数のコメントを追加（スキーマキャッシュの更新を促す）
COMMENT ON FUNCTION public.update_auction_highest_bid(UUID, NUMERIC, UUID) IS 'オークションの最高入札額を更新する関数';

