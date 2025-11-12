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
        purchased_slots (
          id,
          fan_user_id,
          purchased_at,
          call_status,
          winning_bid_amount
        )
      `)
      .eq('user_id', userId)
      .or('fan_user_id.not.is.null,purchased_slots.id.not.is.null')
      .order('scheduled_start_time', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    // データが空の場合は空の配列を返す
    if (!callSlots || callSlots.length === 0) {
      console.log('⚠️ call_slotsが空です');
      return [];
    }

    console.log('🔍 取得したcall_slots数:', callSlots.length);

    // purchased_slots!innerを使用しているので、purchased_slotsが存在するcall_slotsのみが取得される
    // 念のため、fan_user_idまたはpurchased_slotsが存在するcall_slotsを確認
    const validCallSlots = callSlots.filter((cs: any) => {
      const hasFanUserId = cs.fan_user_id !== null && cs.fan_user_id !== undefined;
      const hasPurchasedSlot = cs.purchased_slots && cs.purchased_slots.length > 0;
      const isValid = hasFanUserId || hasPurchasedSlot;
      
      if (!isValid) {
        console.warn('⚠️ 無効なcall_slot:', {
          id: cs.id,
          title: cs.title,
          fan_user_id: cs.fan_user_id,
          purchased_slots: cs.purchased_slots
        });
      }
      
      return isValid;
    });

    console.log('🔍 有効なcall_slots数:', validCallSlots.length, '/', callSlots.length);

    if (validCallSlots.length === 0) {
      console.warn('⚠️ 有効なcall_slotsがありません。全call_slots:', callSlots);
      return [];
    }

    // fan_user_idのリストを取得（call_slotsのfan_user_idまたはpurchased_slotsのfan_user_idから）
    const fanUserIds = validCallSlots
      .map((cs: any) => {
        // call_slotsのfan_user_idが設定されている場合はそれを使用、なければpurchased_slotsから取得
        return cs.fan_user_id || cs.purchased_slots?.[0]?.fan_user_id;
      })
      .filter((id: any) => id !== null && id !== undefined && id !== '');

    console.log('🔍 fan_user_id一覧:', fanUserIds);

    let fanUsersMap: { [key: string]: any } = {};
    if (fanUserIds.length > 0) {
      const { data: fanUsers, error: fanError } = await supabase
        .from('users')
        .select('id, display_name, profile_image_url')
        .in('id', fanUserIds);

      if (fanError) {
        console.error('❌ Fan users取得エラー:', fanError);
      } else if (fanUsers && fanUsers.length > 0) {
        console.log('✅ 取得したfan users:', fanUsers);
        // マップを作成して高速検索可能にする（IDを文字列に変換してキーとして使用）
        fanUsersMap = fanUsers.reduce((acc: any, user: any) => {
          acc[String(user.id)] = user;
          return acc;
        }, {});
      } else {
        console.warn('⚠️ fanUsersが空です。fanUserIds:', fanUserIds);
      }
    } else {
      console.warn('⚠️ fanUserIdsが空です。callSlots:', callSlots.map((cs: any) => cs.fan_user_id));
    }

    // TalkSession形式に変換（call_slotsから直接fan情報を取得）
    const talkSessions: TalkSession[] = validCallSlots.map((callSlot: any) => {
      const purchasedSlot = callSlot.purchased_slots?.[0]; // 1:1関係
      
      // fan_user_idを取得（call_slotsのfan_user_idまたはpurchased_slotsのfan_user_idから）
      const fanUserId = callSlot.fan_user_id || purchasedSlot?.fan_user_id;
      const fanUserIdStr = fanUserId ? String(fanUserId) : null;
      const fan = fanUserIdStr ? fanUsersMap[fanUserIdStr] : null;

      // デバッグログ：fan情報が取得できているか確認
      if (!fan && fanUserId) {
        console.warn('⚠️ fan情報が取得できませんでした:', {
          callSlotId: callSlot.id,
          fanUserId: fanUserId,
          fanUserIdStr: fanUserIdStr,
          fanUserIdsInMap: Object.keys(fanUsersMap),
          callSlotFanUserId: callSlot.fan_user_id,
          purchasedSlotFanUserId: purchasedSlot?.fan_user_id
        });
      }

      // 予定のTalkか過去のTalkかを判定
      const now = new Date();
      const talkDate = new Date(callSlot.scheduled_start_time);
      const isUpcoming = talkDate > now && purchasedSlot?.call_status !== 'completed';

      return {
        id: callSlot.id,
        purchased_slot_id: purchasedSlot?.id,
        influencer_id: userId,
        influencer: {
          id: fanUserId || '', // ファンID（インフルエンサー視点では「相手」）
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
