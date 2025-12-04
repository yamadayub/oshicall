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
  // RPC関数の代わりに直接UPDATE文を使用（PostgRESTのスキーマキャッシュ問題を回避）
  // まず現在のオークション情報を取得
  const { data: currentAuction, error: fetchError } = await supabase
    .from('auctions')
    .select('total_bids_count')
    .eq('id', auctionId)
    .single();
  
  if (fetchError) throw fetchError;

  // オークション情報を更新
  const { error: updateError } = await supabase
    .from('auctions')
    .update({
      current_highest_bid: Number(bidAmount),
      current_winner_id: fanId,
      total_bids_count: (currentAuction?.total_bids_count || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', auctionId);
  
  if (updateError) throw updateError;

  // unique_bidders_countを更新
  const { data: uniqueBiddersData } = await supabase
    .from('bids')
    .select('user_id')
    .eq('auction_id', auctionId);

  if (uniqueBiddersData) {
    const uniqueBidders = new Set(uniqueBiddersData.map(bid => bid.user_id)).size;
    const { error: uniqueBiddersError } = await supabase
      .from('auctions')
      .update({ unique_bidders_count: uniqueBidders })
      .eq('id', auctionId);

    if (uniqueBiddersError) {
      console.error('⚠️ unique_bidders_count更新エラー（無視）:', uniqueBiddersError);
      // このエラーは致命的ではないので、続行
    }
  }
  
  return bid;
};


