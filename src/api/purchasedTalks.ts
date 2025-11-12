import { supabase } from '../lib/supabase';
import { TalkSession } from '../types';

export const getPurchasedTalks = async (userId: string) => {
  try {
    // 落札済みのTalkを取得
    const { data: purchasedSlots, error } = await supabase
      .from('purchased_slots')
      .select(`
        id,
        purchased_at,
        call_status,
        winning_bid_amount,
        call_slots (
          id,
          title,
          description,
          scheduled_start_time,
          duration_minutes,
          thumbnail_url,
          users (
            id,
            display_name,
            profile_image_url,
            average_rating
          )
        )
      `)
      .eq('fan_user_id', userId)
      .order('purchased_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    // データが空の場合は空の配列を返す（エラーではない）
    if (!purchasedSlots || purchasedSlots.length === 0) {
      return [];
    }

    // TalkSession形式に変換
    const talkSessions: TalkSession[] = purchasedSlots.map((slot: any) => {
      const callSlot = slot.call_slots;
      const influencer = callSlot?.users;

      // 予定のTalkか過去のTalkかを判定
      const now = new Date();
      const talkDate = new Date(callSlot?.scheduled_start_time);
      const isUpcoming = talkDate > now && slot.call_status !== 'completed';

      return {
        id: callSlot?.id || slot.id,
        purchased_slot_id: slot.id, // purchased_slots.id for joining calls
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
        title: callSlot?.title || 'Talk枠',
        description: callSlot?.description || '',
        host_message: callSlot?.description || `${influencer?.display_name}とお話ししましょう！`,
        start_time: callSlot?.scheduled_start_time || new Date().toISOString(),
        end_time: callSlot?.scheduled_start_time 
          ? new Date(new Date(callSlot.scheduled_start_time).getTime() + (callSlot.duration_minutes || 30) * 60000).toISOString()
          : new Date().toISOString(),
        auction_end_time: callSlot?.scheduled_start_time || new Date().toISOString(),
        starting_price: slot.winning_bid_amount || 0,
        current_highest_bid: slot.winning_bid_amount || 0,
        status: isUpcoming ? 'won' : 'completed',
        created_at: slot.purchased_at || new Date().toISOString(),
        detail_image_url: callSlot?.thumbnail_url || influencer?.profile_image_url || '/images/talks/default.jpg',
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
    // インフルエンサーが販売したTalkを取得
    const { data: purchasedSlots, error } = await supabase
      .from('purchased_slots')
      .select(`
        id,
        purchased_at,
        call_status,
        winning_bid_amount,
        fan_user_id,
        call_slots (
          id,
          title,
          description,
          scheduled_start_time,
          duration_minutes,
          thumbnail_url
        )
      `)
      .eq('influencer_user_id', userId)
      .order('call_slots(scheduled_start_time)', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    // データが空の場合は空の配列を返す
    if (!purchasedSlots || purchasedSlots.length === 0) {
      return [];
    }

    // ファン情報を取得
    const fanIds = [...new Set(purchasedSlots.map((slot: any) => slot.fan_user_id))];
    console.log('🔍 Fan IDs to fetch:', fanIds);

    const { data: fans, error: fansError } = await supabase
      .from('users')
      .select('id, display_name, profile_image_url')
      .in('id', fanIds);

    if (fansError) {
      console.error('❌ Error fetching fans:', fansError);
    }

    console.log('✅ Fetched fans:', fans);
    const fansMap = new Map(fans?.map(f => [f.id, f]) || []);

    // TalkSession形式に変換
    const talkSessions: TalkSession[] = purchasedSlots.map((slot: any) => {
      const callSlot = slot.call_slots;
      const fan = fansMap.get(slot.fan_user_id);

      console.log('🔍 Processing slot:', {
        fan_user_id: slot.fan_user_id,
        fan: fan,
        fanName: fan?.display_name,
        fanAvatar: fan?.profile_image_url,
      });

      // 予定のTalkか過去のTalkかを判定
      const now = new Date();
      const talkDate = new Date(callSlot?.scheduled_start_time);
      const isUpcoming = talkDate > now && slot.call_status !== 'completed';

      return {
        id: callSlot?.id || slot.id,
        purchased_slot_id: slot.id, // purchased_slots.id for joining calls
        influencer_id: userId,
        influencer: {
          id: fan?.id || '',
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
        title: callSlot?.title || 'Talk枠',
        description: callSlot?.description || '',
        host_message: callSlot?.description || `${fan?.display_name}さんとのTalk`,
        start_time: callSlot?.scheduled_start_time || new Date().toISOString(),
        end_time: callSlot?.scheduled_start_time
          ? new Date(new Date(callSlot.scheduled_start_time).getTime() + (callSlot.duration_minutes || 30) * 60000).toISOString()
          : new Date().toISOString(),
        auction_end_time: callSlot?.scheduled_start_time || new Date().toISOString(),
        starting_price: slot.winning_bid_amount || 0,
        current_highest_bid: slot.winning_bid_amount || 0,
        status: isUpcoming ? 'won' : 'completed',
        created_at: slot.purchased_at || new Date().toISOString(),
        detail_image_url: callSlot?.thumbnail_url || '/images/talks/default.jpg',
        is_female_only: false,
      };
    });

    console.log('✅ Converted TalkSessions:', talkSessions.map(t => ({
      id: t.id,
      influencerName: t.influencer.name,
      influencerAvatar: t.influencer.avatar_url,
    })));

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
