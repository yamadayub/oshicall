import { supabase, type Auction, type Bid } from '../lib/supabase';

// アクティブなオークション一覧を取得
export const getActiveAuctions = async () => {
  const { data, error } = await supabase
    .from('active_auctions_view')
    .select('*')
    .order('end_time', { ascending: true });
  
  if (error) throw error;
  return data;
};

// オークション詳細を取得
export const getAuctionDetails = async (auctionId: string) => {
  const { data: auction, error: auctionError } = await supabase
    .from('auctions')
    .select(`
      *,
      call_slots (*),
      influencers:call_slots(influencers(*))
    `)
    .eq('id', auctionId)
    .single();
  
  if (auctionError) throw auctionError;
  
  // 入札履歴を取得
  const { data: bids, error: bidsError } = await supabase
    .from('bids')
    .select('*, fans(display_name, profile_image_url)')
    .eq('auction_id', auctionId)
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (bidsError) throw bidsError;
  
  return { ...auction, bids };
};

// リアルタイム入札更新をサブスクライブ
export const subscribeToAuctionUpdates = (
  auctionId: string,
  onBidUpdate: (bid: Bid) => void
) => {
  const channel = supabase
    .channel(`auction-${auctionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'bids',
        filter: `auction_id=eq.${auctionId}`,
      },
      (payload) => {
        onBidUpdate(payload.new as Bid);
      }
    )
    .subscribe();
  
  return () => {
    supabase.removeChannel(channel);
  };
};

// 入札を実行
export const placeBid = async (
  auctionId: string,
  fanId: string,
  bidAmount: number,
  paymentIntentId: string
) => {
  // 入札を記録
  const { data: bid, error: bidError } = await supabase
    .from('bids')
    .insert({
      auction_id: auctionId,
      user_id: fanId,
      bid_amount: bidAmount,
      stripe_payment_intent_id: paymentIntentId,
    })
    .select()
    .single();

  if (bidError) throw bidError;

  // オークション情報を更新
  // RPC関数を使用（元の実装に戻す）
  const { error: updateError } = await supabase.rpc(
    'update_auction_highest_bid',
    {
      p_auction_id: auctionId,
      p_bid_amount: Number(bidAmount),
      p_user_id: fanId,
    }
  );
  
  if (updateError) throw updateError;
  
  return bid;
};


