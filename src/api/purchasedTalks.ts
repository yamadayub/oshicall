import { supabase } from '../lib/supabase';
import { TalkSession } from '../types';

export const getPurchasedTalks = async (userId: string) => {
  try {
    // 新スキーマ: call_slotsから直接fan_user_idでフィルタリング
    const { data: callSlots, error } = await supabase
      .from('call_slots')
      .select(`
        id,
        title,
        description,
        scheduled_start_time,
        duration_minutes,
        thumbnail_url,
        user_id,
        influencer:user_id (
          id,
          display_name,
          profile_image_url,
          average_rating
        ),
        purchased_slots (
          id,
          purchased_at,
          call_status,
          winning_bid_amount
        )
      `)
      .eq('fan_user_id', userId)
      .order('scheduled_start_time', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    // データが空の場合は空の配列を返す（エラーではない）
    if (!callSlots || callSlots.length === 0) {
      return [];
    }

    // TalkSession形式に変換
    const talkSessions: TalkSession[] = callSlots.map((callSlot: any) => {
      const influencer = callSlot.influencer; // user_idリレーション
      const purchasedSlot = callSlot.purchased_slots?.[0]; // 1:1関係

      // 予定のTalkか過去のTalkかを判定
      const now = new Date();
      const talkDate = new Date(callSlot.scheduled_start_time);
      const isUpcoming = talkDate > now && purchasedSlot?.call_status !== 'completed';

      return {
        id: callSlot.id,
        purchased_slot_id: purchasedSlot?.id,
        influencer_id: influencer?.id,
        influencer: {
          id: influencer?.id || '',
          name: influencer?.display_name || '不明',
          username: influencer?.display_name || '不明',
          avatar_url: influencer?.profile_image_url || '/images/default-avatar.png',
          description: '',
          follower_count: 0,
          total_earned: 0,
          total_talks: 0,
          rating: influencer?.average_rating || 0,
          created_at: new Date().toISOString(),
        },
        title: callSlot.title || 'Talk枠',
        description: callSlot.description || '',
        host_message: callSlot.description || `${influencer?.display_name}とお話ししましょう！`,
        start_time: callSlot.scheduled_start_time || new Date().toISOString(),
        end_time: callSlot.scheduled_start_time
          ? new Date(new Date(callSlot.scheduled_start_time).getTime() + (callSlot.duration_minutes || 30) * 60000).toISOString()
          : new Date().toISOString(),
        auction_end_time: callSlot.scheduled_start_time || new Date().toISOString(),
        starting_price: purchasedSlot?.winning_bid_amount || 0,
        current_highest_bid: purchasedSlot?.winning_bid_amount || 0,
        status: isUpcoming ? 'won' : 'completed',
        created_at: purchasedSlot?.purchased_at || new Date().toISOString(),
        detail_image_url: callSlot.thumbnail_url || influencer?.profile_image_url || '/images/talks/default.jpg',
        is_female_only: false,
      };
    });

    return talkSessions;
  } catch (error) {
    console.error('落札済みTalk取得エラー:', error);
    throw error;
  }
};

export const getUpcomingPurchasedTalks = async (userId: string) => {
  const allTalks = await getPurchasedTalks(userId);
  const now = new Date();
  
  return allTalks.filter(talk => {
    const talkDate = new Date(talk.start_time);
    return talkDate > now && talk.status === 'won';
  });
};

export const getCompletedPurchasedTalks = async (userId: string) => {
  const allTalks = await getPurchasedTalks(userId);
  const now = new Date();

  return allTalks.filter(talk => {
    const talkDate = new Date(talk.start_time);
    return talkDate <= now || talk.status === 'completed';
  });
};

// インフルエンサー用：ホストするTalk（販売済みスロット）を取得
export const getInfluencerHostedTalks = async (userId: string) => {
  try {
    // 新スキーマ: call_slotsから直接fan_user_idを取得
    // user_id（インフルエンサー）でフィルタリングし、fan_user_idが存在する（落札済み）スロットを取得
    const { data: callSlots, error } = await supabase
      .from('call_slots')
      .select(`
        id,
        title,
        description,
        scheduled_start_time,
        duration_minutes,
        thumbnail_url,
        fan_user_id,
        fan:fan_user_id (
          id,
          display_name,
          profile_image_url
        ),
        purchased_slots (
          id,
          purchased_at,
          call_status,
          winning_bid_amount
        )
      `)
      .eq('user_id', userId)
      .not('fan_user_id', 'is', null)
      .order('scheduled_start_time', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    // データが空の場合は空の配列を返す
    if (!callSlots || callSlots.length === 0) {
      return [];
    }

    // TalkSession形式に変換（call_slotsから直接fan情報を取得）
    const talkSessions: TalkSession[] = callSlots.map((callSlot: any) => {
      const fan = callSlot.fan; // fan_user_idリレーション
      const purchasedSlot = callSlot.purchased_slots?.[0]; // 1:1関係

      // 予定のTalkか過去のTalkかを判定
      const now = new Date();
      const talkDate = new Date(callSlot.scheduled_start_time);
      const isUpcoming = talkDate > now && purchasedSlot?.call_status !== 'completed';

      return {
        id: callSlot.id,
        purchased_slot_id: purchasedSlot?.id,
        influencer_id: userId,
        influencer: {
          id: callSlot.fan_user_id || '', // ファンID（インフルエンサー視点では「相手」）
          name: fan?.display_name || '購入者',
          username: fan?.display_name || '購入者',
          avatar_url: fan?.profile_image_url || '/images/default-avatar.png',
          description: '',
          follower_count: 0,
          total_earned: 0,
          total_talks: 0,
          rating: 0,
          created_at: new Date().toISOString(),
        },
        title: callSlot.title || 'Talk枠',
        description: callSlot.description || '',
        host_message: callSlot.description || `${fan?.display_name}さんとのTalk`,
        start_time: callSlot.scheduled_start_time || new Date().toISOString(),
        end_time: callSlot.scheduled_start_time
          ? new Date(new Date(callSlot.scheduled_start_time).getTime() + (callSlot.duration_minutes || 30) * 60000).toISOString()
          : new Date().toISOString(),
        auction_end_time: callSlot.scheduled_start_time || new Date().toISOString(),
        starting_price: purchasedSlot?.winning_bid_amount || 0,
        current_highest_bid: purchasedSlot?.winning_bid_amount || 0,
        status: isUpcoming ? 'won' : 'completed',
        created_at: purchasedSlot?.purchased_at || new Date().toISOString(),
        detail_image_url: callSlot.thumbnail_url || '/images/talks/default.jpg',
        is_female_only: false,
      };
    });

    return talkSessions;
  } catch (error) {
    console.error('ホストTalk取得エラー:', error);
    throw error;
  }
};

export const getUpcomingHostedTalks = async (userId: string) => {
  const allTalks = await getInfluencerHostedTalks(userId);
  const now = new Date();

  return allTalks.filter(talk => {
    const talkDate = new Date(talk.start_time);
    return talkDate > now && talk.status === 'won';
  });
};

export const getCompletedHostedTalks = async (userId: string) => {
  const allTalks = await getInfluencerHostedTalks(userId);
  const now = new Date();

  return allTalks.filter(talk => {
    const talkDate = new Date(talk.start_time);
    return talkDate <= now || talk.status === 'completed';
  });
};
