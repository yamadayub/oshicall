-- =========================================
-- Production環境に不足しているRPC関数を全て追加
-- =========================================
-- Staging環境で動作している全ての関数をProduction環境に追加
-- =========================================

-- 1. update_auction_highest_bid (既に追加済みだが、念のため再作成)
CREATE OR REPLACE FUNCTION public.update_auction_highest_bid(
  p_auction_id UUID,
  p_bid_amount NUMERIC,
  p_user_id UUID
)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION public.update_auction_highest_bid(UUID, NUMERIC, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_auction_highest_bid(UUID, NUMERIC, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.update_auction_highest_bid(UUID, NUMERIC, UUID) TO service_role;

-- 2. finalize_auction
CREATE OR REPLACE FUNCTION public.finalize_auction(p_auction_id UUID)
RETURNS TABLE(
  winner_user_id UUID,
  winning_amount DECIMAL,
  call_slot_id UUID
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction RECORD;
BEGIN
  SELECT * INTO v_auction FROM auctions WHERE id = p_auction_id;
  
  IF v_auction.current_winner_id IS NULL THEN
    UPDATE auctions SET status = 'ended' WHERE id = p_auction_id;
    RETURN;
  END IF;
  
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
  
  UPDATE auctions SET status = 'ended' WHERE id = p_auction_id;
  
  RETURN QUERY
  SELECT 
    v_auction.current_winner_id,
    v_auction.current_highest_bid,
    v_auction.call_slot_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_auction(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_auction(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.finalize_auction(UUID) TO service_role;

-- 3. update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- 4. calculate_call_slot_end_time
CREATE OR REPLACE FUNCTION public.calculate_call_slot_end_time()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.end_time = NEW.scheduled_start_time + (NEW.duration_minutes || ' minutes')::INTERVAL;
  RETURN NEW;
END;
$$;

-- 5. create_auction_with_default_end_time
-- 既存の関数を削除してから再作成（戻り値の型を変更するため）
DROP FUNCTION IF EXISTS public.create_auction_with_default_end_time(UUID, TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS public.create_auction_with_default_end_time(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.create_auction_with_default_end_time(
  p_call_slot_id UUID,
  p_start_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction_id UUID;
  v_end_time TIMESTAMPTZ;
BEGIN
  -- call_slotsからend_timeを取得
  SELECT end_time INTO v_end_time
  FROM call_slots
  WHERE id = p_call_slot_id;
  
  -- オークションを作成
  INSERT INTO auctions (
    call_slot_id,
    start_time,
    end_time,
    auction_end_time,
    status
  )
  VALUES (
    p_call_slot_id,
    p_start_time,
    v_end_time,
    v_end_time,
    'active'
  )
  RETURNING id INTO v_auction_id;
  
  RETURN v_auction_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_auction_with_default_end_time(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_auction_with_default_end_time(UUID, TIMESTAMPTZ) TO service_role;

-- 6. get_auction_end_time (既存を削除してから再作成)
DROP FUNCTION IF EXISTS public.get_auction_end_time(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.get_auction_end_time(p_auction_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_end_time TIMESTAMPTZ;
BEGIN
  SELECT auction_end_time INTO v_end_time
  FROM auctions
  WHERE id = p_auction_id;
  
  RETURN v_end_time;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_auction_end_time(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auction_end_time(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_auction_end_time(UUID) TO service_role;

-- 7. update_auction_end_time (既存を削除してから再作成)
DROP FUNCTION IF EXISTS public.update_auction_end_time(UUID, TIMESTAMPTZ) CASCADE;

CREATE OR REPLACE FUNCTION public.update_auction_end_time(
  p_auction_id UUID,
  p_new_end_time TIMESTAMPTZ
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE auctions
  SET auction_end_time = p_new_end_time,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_auction_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_auction_end_time(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_auction_end_time(UUID, TIMESTAMPTZ) TO service_role;

-- 8. update_call_slot_status_live
CREATE OR REPLACE FUNCTION public.update_call_slot_status_live()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE call_slots
  SET status = 'live'
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- 9. update_call_slot_status_completed
CREATE OR REPLACE FUNCTION public.update_call_slot_status_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE call_slots
  SET status = 'completed'
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- 10. update_user_statistics
CREATE OR REPLACE FUNCTION public.update_user_statistics(
  p_fan_id UUID,
  p_influencer_id UUID,
  p_amount NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ファン（落札者）の統計を更新
  UPDATE users
  SET 
    total_spent = total_spent + p_amount,
    total_calls_purchased = total_calls_purchased + 1,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_fan_id;
  
  -- インフルエンサーの統計を更新
  UPDATE users
  SET 
    total_earnings = total_earnings + (p_amount * 0.8), -- 80%（手数料20%引き）
    total_calls_completed = total_calls_completed + 1,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_influencer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_statistics(UUID, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_statistics(UUID, UUID, NUMERIC) TO service_role;

-- 11. get_follow_counts
CREATE OR REPLACE FUNCTION public.get_follow_counts(user_id UUID)
RETURNS TABLE(
  followers_count BIGINT,
  following_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM follows WHERE following_id = user_id)::BIGINT as followers_count,
    (SELECT COUNT(*) FROM follows WHERE follower_id = user_id)::BIGINT as following_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_follow_counts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_follow_counts(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_follow_counts(UUID) TO service_role;

-- 12. is_following
CREATE OR REPLACE FUNCTION public.is_following(
  follower_id UUID,
  following_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM follows
    WHERE follows.follower_id = is_following.follower_id
    AND follows.following_id = is_following.following_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_following(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_following(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.is_following(UUID, UUID) TO service_role;

-- 13. handle_new_user (既に存在する可能性があるが、念のため)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (auth_user_id, display_name, is_fan, is_influencer)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    true,
    false
  );
  RETURN NEW;
END;
$$;

-- 14. ensure_fan_default
CREATE OR REPLACE FUNCTION public.ensure_fan_default()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_fan IS NULL AND NEW.is_influencer IS NULL THEN
    NEW.is_fan := true;
    NEW.is_influencer := false;
  END IF;
  RETURN NEW;
END;
$$;

-- 15. debug_user_insert
CREATE OR REPLACE FUNCTION public.debug_user_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE NOTICE 'New user inserted: %', NEW.id;
  RETURN NEW;
END;
$$;

-- PostgRESTのスキーマキャッシュをリフレッシュ
NOTIFY pgrst, 'reload schema';

