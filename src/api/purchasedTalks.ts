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

    // purchased_slotsの生データを確認
    console.log('🔍 Raw purchased_slots data:', purchasedSlots.map(slot => ({
      id: slot.id,
      fan_user_id: slot.fan_user_id,
      fan_user_id_type: typeof slot.fan_user_id,
      influencer_user_id: slot.influencer_user_id,
      all_keys: Object.keys(slot),
    })));

    // ファン情報を取得
    const fanIds = [...new Set(purchasedSlots.map((slot: any) => slot.fan_user_id))].filter(id => id);
    console.log('🔍 Fan IDs to fetch:', fanIds);
    console.log('🔍 Fan IDs types:', fanIds.map(id => typeof id));

    if (fanIds.length === 0) {
      console.warn('⚠️ No fan IDs found in purchased_slots');
      return purchasedSlots.map((slot: any) => {
        const callSlot = slot.call_slots;
        const now = new Date();
        const talkDate = new Date(callSlot?.scheduled_start_time);
        const isUpcoming = talkDate > now && slot.call_status !== 'completed';

        return {
          id: callSlot?.id || slot.id,
          purchased_slot_id: slot.id,
          influencer_id: userId,
          influencer: {
            id: slot.fan_user_id || '', // fan_user_idを直接使用
            name: '購入者',
            username: '購入者',
            avatar_url: '/images/default-avatar.png',
            description: '',
            follower_count: 0,
            total_earned: 0,
            total_talks: 0,
            rating: 0,
            created_at: new Date().toISOString(),
          },
          title: callSlot?.title || 'Talk枠',
          description: callSlot?.description || '',
          host_message: callSlot?.description || 'Talk',
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
    }

    const { data: fans, error: fansError } = await supabase
      .from('users')
      .select('id, display_name, profile_image_url')
      .in('id', fanIds);

    if (fansError) {
      console.error('❌ Error fetching fans:', fansError);
      console.error('❌ Supabase error details:', {
        message: fansError.message,
        details: fansError.details,
        hint: fansError.hint,
        code: fansError.code,
      });
    }

    console.log('✅ Fetched fans raw data:', fans);
    console.log('🔍 Fan IDs to match:', fanIds);
    console.log('🔍 Number of fans fetched:', fans?.length || 0);
    console.log('🔍 Number of fan IDs requested:', fanIds.length);

    if (fans && fans.length > 0) {
      console.log('🔍 Fans map will be:', fans.map(f => `${f.id}: ${f.display_name}`));
      fans.forEach(f => {
        console.log('🔍 Fan in result:', { id: f.id, id_type: typeof f.id, name: f.display_name });
      });
    } else {
      console.warn('⚠️ No fans returned from Supabase query!');
    }

    const fansMap = new Map(fans?.map(f => [f.id, f]) || []);
    console.log('🔍 fansMap size:', fansMap.size);
    console.log('🔍 fansMap keys:', Array.from(fansMap.keys()));

    // TalkSession形式に変換
    const talkSessions: TalkSession[] = purchasedSlots.map((slot: any) => {
      const callSlot = slot.call_slots;
      const fan = fansMap.get(slot.fan_user_id);

      console.log('🔍 Processing slot:', {
        slot_id: slot.id,
        fan_user_id: slot.fan_user_id,
        fan_user_id_type: typeof slot.fan_user_id,
        fan_from_map: fan,
        fanName: fan?.display_name,
        fanAvatar: fan?.profile_image_url,
        fanId: fan?.id,
        has_fan: !!fan,
        map_has_key: fansMap.has(slot.fan_user_id),
        map_size: fansMap.size,
      });

      // 予定のTalkか過去のTalkかを判定
      const now = new Date();
      const talkDate = new Date(callSlot?.scheduled_start_time);
      const isUpcoming = talkDate > now && slot.call_status !== 'completed';

      // fan?.idがundefinedの場合はslot.fan_user_idを使う（重要！）
      // slot.fan_user_idを常に優先して使用
      const fanId = slot.fan_user_id || fan?.id || '';

      console.log('🔍 Final fan ID for slot:', {
        slot_id: slot.id,
        fanId,
        source: slot.fan_user_id ? 'slot.fan_user_id' : (fan?.id ? 'fan.id' : 'empty'),
        fan_user_id: slot.fan_user_id,
        fan_id_from_map: fan?.id,
      });

      return {
        id: callSlot?.id || slot.id,
        purchased_slot_id: slot.id, // purchased_slots.id for joining calls
        influencer_id: userId,
        influencer: {
          id: fanId, // ファンIDをここに格納（インフルエンサー視点では「相手」がファン）
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
