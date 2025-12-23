import { supabase, type CallSlot, type Auction } from '../lib/supabase';

// 通話枠を作成
export const createCallSlot = async (
  influencerId: string,
  slotData: {
    title: string;
    description: string;
    scheduled_start_time: string;
    duration_minutes: number;
    starting_price: number;
    minimum_bid_increment?: number;
    thumbnail_url?: string;
  }
) => {
  const { data, error } = await supabase
    .from('call_slots')
    .insert({
      influencer_id: influencerId,
      ...slotData,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// オークションを作成
export const createAuction = async (
  callSlotId: string,
  auctionData: {
    start_time: string;
    end_time: string;
  }
) => {
  const { data, error } = await supabase
    .from('auctions')
    .insert({
      call_slot_id: callSlotId,
      status: 'scheduled',
      ...auctionData,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// 通話枠を公開
export const publishCallSlot = async (callSlotId: string) => {
  const { data, error } = await supabase
    .from('call_slots')
    .update({ is_published: true })
    .eq('id', callSlotId)
    .is('deleted_at', null)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// インフルエンサーの通話枠一覧を取得
export const getInfluencerCallSlots = async (influencerId: string) => {
  const { data, error } = await supabase
    .from('call_slots')
    .select(`
      *,
      auctions (*)
    `)
    .eq('influencer_id', influencerId)
    .is('deleted_at', null)
    .order('scheduled_start_time', { ascending: false });
  
  if (error) throw error;
  return data;
};

// インフルエンサーの購入済み通話一覧を取得
export const getInfluencerPurchasedSlots = async (influencerId: string) => {
  const { data, error } = await supabase
    .from('purchased_slots')
    .select(`
      *,
      fans (display_name, profile_image_url),
      call_slots (title, scheduled_start_time, duration_minutes)
    `)
    .eq('influencer_id', influencerId)
    .order('purchased_at', { ascending: false });
  
  if (error) throw error;
  return data;
};

// インフルエンサーの収益統計を取得
export const getInfluencerEarnings = async (influencerId: string) => {
  const { data, error } = await supabase
    .from('purchased_slots')
    .select('influencer_payout, purchased_at')
    .eq('influencer_id', influencerId)
    .eq('call_status', 'completed');
  
  if (error) throw error;
  
  // 統計を計算
  const totalEarnings = data.reduce((sum, slot) => sum + slot.influencer_payout, 0);
  const completedCalls = data.length;
  
  return {
    totalEarnings,
    completedCalls,
    earnings: data,
  };
};

// 通話枠を更新
export const updateCallSlot = async (
  callSlotId: string,
  updates: Partial<CallSlot>
) => {
  const { data, error } = await supabase
    .from('call_slots')
    .update(updates)
    .eq('id', callSlotId)
    .is('deleted_at', null)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// 通話枠を削除（論理削除）
export const deleteCallSlot = async (callSlotId: string) => {
  const { error } = await supabase
    .from('call_slots')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', callSlotId)
    .is('deleted_at', null); // 既に削除されているものは更新しない
  
  if (error) throw error;
};

// オークションをキャンセル
export const cancelAuction = async (auctionId: string) => {
  const { data, error } = await supabase
    .from('auctions')
    .update({ status: 'cancelled' })
    .eq('id', auctionId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// 通話ステータスを更新
export const updateCallStatus = async (
  purchasedSlotId: string,
  status: 'pending' | 'ready' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
) => {
  const updates: any = { call_status: status };
  
  // ステータスに応じてタイムスタンプを更新
  if (status === 'in_progress') {
    updates.call_started_at = new Date().toISOString();
  } else if (status === 'completed') {
    updates.call_ended_at = new Date().toISOString();
  }
  
  const { data, error } = await supabase
    .from('purchased_slots')
    .update(updates)
    .eq('id', purchasedSlotId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// インフルエンサーのダッシュボード統計を取得
export const getInfluencerDashboardStats = async (influencerId: string) => {
  // 今月の統計
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  
  const { data: monthlySlots, error: slotsError } = await supabase
    .from('purchased_slots')
    .select('influencer_payout, call_status')
    .eq('influencer_id', influencerId)
    .gte('purchased_at', startOfMonth);
  
  if (slotsError) throw slotsError;
  
  // アクティブなオークション数
  const { count: activeAuctionsCount, error: auctionsError } = await supabase
    .from('auctions')
    .select('id', { count: 'exact' })
    .eq('call_slots.influencer_id', influencerId)
    .eq('status', 'active');
  
  if (auctionsError) throw auctionsError;
  
  // 今後の予定通話数
  const { count: upcomingCallsCount, error: upcomingError } = await supabase
    .from('purchased_slots')
    .select('id', { count: 'exact' })
    .eq('influencer_id', influencerId)
    .in('call_status', ['pending', 'ready']);
  
  if (upcomingError) throw upcomingError;
  
  const monthlyEarnings = monthlySlots
    .filter(slot => slot.call_status === 'completed')
    .reduce((sum, slot) => sum + slot.influencer_payout, 0);
  
  const completedCallsThisMonth = monthlySlots.filter(
    slot => slot.call_status === 'completed'
  ).length;
  
  return {
    monthlyEarnings,
    completedCallsThisMonth,
    activeAuctionsCount: activeAuctionsCount || 0,
    upcomingCallsCount: upcomingCallsCount || 0,
  };
};


