import { supabase } from '../lib/supabase';
import type { CallSlot, Auction } from '../lib/supabase';

export interface CreateCallSlotInput {
  title: string;
  description: string;
  scheduled_start_time: string;
  duration_minutes: number;
  starting_price: number;
  minimum_bid_increment: number;
  buy_now_price?: number | null; // 即決価格
  thumbnail_url?: string;
  auction_end_time: string; // オークション終了時間
}

// インフルエンサーのCall Slotsを作成
export const createCallSlot = async (
  userId: string,
  input: CreateCallSlotInput
): Promise<{ callSlot: CallSlot; auction: Auction }> => {
  // フロントエンドからUTC形式のISO文字列が送信される
  // 例: "2025-01-15T14:30:00.000Z"
  const scheduledTimeUTC = input.scheduled_start_time;
  const auctionEndTimeUTC = input.auction_end_time;

  // end_timeを計算: scheduled_start_time + duration_minutes
  const scheduledTime = new Date(scheduledTimeUTC);
  const endTime = new Date(scheduledTime.getTime() + input.duration_minutes * 60 * 1000);
  const endTimeUTC = endTime.toISOString();

  console.log('📅 Talk開始時間:', {
    scheduled_start_time: scheduledTimeUTC,
    duration_minutes: input.duration_minutes,
    end_time: endTimeUTC,
    auction_end_time: auctionEndTimeUTC
  });

  // 1. Call Slotを作成
  const { data: callSlot, error: callSlotError } = await supabase
    .from('call_slots')
    .insert({
      user_id: userId,
      title: input.title,
      description: input.description,
      scheduled_start_time: scheduledTimeUTC, // UTC形式で保存
      duration_minutes: input.duration_minutes,
      end_time: endTimeUTC, // scheduled_start_time + duration_minutes
      starting_price: input.starting_price,
      minimum_bid_increment: input.minimum_bid_increment,
      buy_now_price: input.buy_now_price || null,
      thumbnail_url: input.thumbnail_url || null,
      is_published: true,
    })
    .select()
    .single();

  if (callSlotError) throw callSlotError;

  // 2. オークションを自動作成
  const auctionStartTime = new Date(); // 今すぐ開始

  console.log('🕐 オークション時間設定:', {
    scheduledTime: scheduledTimeUTC,
    auctionStartTime: auctionStartTime.toISOString(),
    auctionEndTime: auctionEndTimeUTC
  });

  const { data: auction, error: auctionError } = await supabase
    .from('auctions')
    .insert({
      call_slot_id: callSlot.id,
      status: 'active',
      start_time: auctionStartTime.toISOString(),
      end_time: auctionEndTimeUTC, // UTC形式で保存
      auction_end_time: auctionEndTimeUTC, // auction_end_timeも同じ値
    })
    .select()
    .single();

  if (auctionError) {
    // オークション作成失敗時はCall Slotを削除
    await supabase.from('call_slots').delete().eq('id', callSlot.id);
    throw auctionError;
  }

  // 3. フォロワーへの通知メールを送信（Edge Functionを呼び出し）
  try {
    console.log('📧 フォロワー通知Edge Function呼び出し開始');

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const { data: { session } } = await supabase.auth.getSession();
    const functionUrl = `${supabaseUrl}/functions/v1/notify-new-talk-slot`;

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        record: {
          id: callSlot.id,
          user_id: callSlot.user_id,
          title: callSlot.title,
          description: callSlot.description,
          scheduled_start_time: callSlot.scheduled_start_time,
          duration_minutes: callSlot.duration_minutes,
          starting_price: callSlot.starting_price,
          is_published: callSlot.is_published,
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ フォロワー通知Edge Function呼び出しエラー:', errorText);
      // エラーでもTalk枠作成自体は成功させる
    } else {
      const result = await response.json();
      console.log('✅ フォロワー通知Edge Function呼び出し成功:', result);
    }
  } catch (notifyError: any) {
    console.error('❌ フォロワー通知処理でエラー:', notifyError.message);
    // エラーでもTalk枠作成自体は成功させる
  }

  return { callSlot, auction };
};

// インフルエンサーの全Call Slotsを取得（オークション情報も含む）
export const getInfluencerCallSlots = async (
  userId: string
): Promise<CallSlot[]> => {
  const { data, error } = await supabase
    .from('call_slots')
    .select(`
      *,
      auctions!call_slot_id (
        id,
        end_time,
        auction_end_time,
        status
      )
    `)
    .eq('user_id', userId)
    .order('scheduled_start_time', { ascending: false });

  if (error) throw error;
  
  // オークション情報をCallSlotにマッピング
  const callSlots = (data || []).map((slot: any) => {
    // auctionsが配列かオブジェクトかを判定
    const auction = Array.isArray(slot.auctions) ? slot.auctions[0] : slot.auctions;
    
    return {
      ...slot,
      auction_end_time: auction?.auction_end_time || auction?.end_time,
      auction_id: auction?.id,
    };
  });

  return callSlots;
};

// Call Slotを更新
export const updateCallSlot = async (
  callSlotId: string,
  updates: Partial<CreateCallSlotInput>
): Promise<CallSlot> => {
  // scheduled_start_timeとduration_minutesが更新される場合、end_timeも再計算
  const updateData: any = { ...updates };
  
  // scheduled_start_timeがdatetime-local形式（YYYY-MM-DDTHH:mm）の場合、UTC形式に変換
  if (updateData.scheduled_start_time && !updateData.scheduled_start_time.includes('Z') && !updateData.scheduled_start_time.includes('+')) {
    // datetime-local形式をUTC形式に変換
    const localDate = new Date(updateData.scheduled_start_time);
    updateData.scheduled_start_time = localDate.toISOString();
  }
  
  // end_timeを計算: scheduled_start_time + duration_minutes
  if (updateData.scheduled_start_time && updateData.duration_minutes) {
    const scheduledTime = new Date(updateData.scheduled_start_time);
    const endTime = new Date(scheduledTime.getTime() + updateData.duration_minutes * 60 * 1000);
    updateData.end_time = endTime.toISOString();
  } else if (updateData.scheduled_start_time || updateData.duration_minutes) {
    // どちらか一方だけが更新される場合、既存のデータを取得して計算
    const { data: existingSlot } = await supabase
      .from('call_slots')
      .select('scheduled_start_time, duration_minutes')
      .eq('id', callSlotId)
      .single();
    
    if (existingSlot) {
      const scheduledTime = new Date(updateData.scheduled_start_time || existingSlot.scheduled_start_time);
      const durationMinutes = updateData.duration_minutes || existingSlot.duration_minutes;
      const endTime = new Date(scheduledTime.getTime() + durationMinutes * 60 * 1000);
      updateData.end_time = endTime.toISOString();
    }
  }

  const { data, error } = await supabase
    .from('call_slots')
    .update(updateData)
    .eq('id', callSlotId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Call Slotを削除
export const deleteCallSlot = async (callSlotId: string): Promise<void> => {
  const { error } = await supabase
    .from('call_slots')
    .delete()
    .eq('id', callSlotId);

  if (error) throw error;
};

// Call Slotの公開/非公開を切り替え
export const toggleCallSlotPublish = async (
  callSlotId: string,
  isPublished: boolean
): Promise<CallSlot> => {
  const { data, error } = await supabase
    .from('call_slots')
    .update({ is_published: isPublished })
    .eq('id', callSlotId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

