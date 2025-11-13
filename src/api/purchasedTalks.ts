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

    // ファン情報をusersテーブルから取得
    const { data: fanUser, error: fanError } = await supabase
      .from('users')
      .select('id, display_name, profile_image_url, bio')
      .eq('id', userId)
      .single();

    if (fanError) {
      console.error('❌ [getPurchasedTalks] ファン情報取得エラー:', fanError);
    }

    // TalkSession形式に変換
    const talkSessions: TalkSession[] = callSlots.map((callSlot: any) => {
      const influencer = callSlot.influencer; // user_idリレーション
      const purchasedSlot = callSlot.purchased_slots?.[0]; // 1:1関係

      // call_slotsからuser_id（インフルエンサー）とfan_user_id（ファン）を取得
      const influencerUserId = callSlot.user_id; // インフルエンサーのuser_id
      const fanUserId = userId; // 現在のユーザー（ファン）のuser_id

      // 予定のTalkか過去のTalkかを判定
      const now = new Date();
      const talkDate = new Date(callSlot.scheduled_start_time);
      const isUpcoming = talkDate > now && purchasedSlot?.call_status !== 'completed';

      // 詳細ログ: 各Talk枠について、call_slotsとusersテーブルの情報をまとめて出力
      console.log('📋 [getPurchasedTalks] Talk枠情報:', {
        '=== Talk枠基本情報 ===': '',
        'Talk枠ID': callSlot.id,
        'Talk枠タイトル': callSlot.title,
        '予定開始時刻': callSlot.scheduled_start_time,
        '',
        '=== call_slotsテーブルから取得 ===': '',
        'call_slots.user_id (インフルエンサー)': influencerUserId,
        'call_slots.fan_user_id (ファン)': fanUserId,
        '',
        '=== usersテーブルから取得 - インフルエンサー情報 ===': '',
        'users.id': influencer?.id,
        'users.display_name': influencer?.display_name,
        'users.profile_image_url': influencer?.profile_image_url,
        'users.average_rating': influencer?.average_rating,
        '',
        '=== usersテーブルから取得 - ファン情報 ===': '',
        'users.id': fanUser?.id || '(未取得)',
        'users.display_name': fanUser?.display_name || '(未取得)',
        'users.profile_image_url': fanUser?.profile_image_url || '(未取得)',
        'users.bio': fanUser?.bio || '(未取得)',
      });

      const talkSession = {
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

      // 詳細ログ: 最終的なTalkSessionオブジェクト
      console.log('✅ [getPurchasedTalks] 最終TalkSessionオブジェクト:', {
        'Talk枠ID': talkSession.id,
        'purchased_slot_id': talkSession.purchased_slot_id,
        'インフルエンサーuser_id (talkSession.influencer_id)': talkSession.influencer_id,
        'インフルエンサーuser_id (talkSession.influencer.id)': talkSession.influencer.id,
        '表示名 (talkSession.influencer.name)': talkSession.influencer.name,
        '表示画像URL (talkSession.influencer.avatar_url)': talkSession.influencer.avatar_url,
        'Talk枠タイトル': talkSession.title,
        '背景画像URL (talkSession.detail_image_url)': talkSession.detail_image_url,
        '開始時刻': talkSession.start_time,
        'ステータス': talkSession.status,
      });

      return talkSession;
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
    // 新スキーマ: call_slotsからuser_id（ホスト）とfan_user_id（落札者）を取得
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
        user_id,
        fan_user_id,
        influencer:user_id (
          id,
          display_name,
          profile_image_url,
          bio,
          average_rating
        ),
        purchased_slots (
          id,
          fan_user_id,
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

    // call_slotsからfan_user_idのリストを取得
    const fanUserIds = callSlots
      .map((cs: any) => cs.fan_user_id)
      .filter((id: any) => id !== null && id !== undefined && id !== '');

    // 重複を除去
    const uniqueFanUserIds = [...new Set(fanUserIds)];

    // usersテーブルからfan_user_idをキーにuser情報を取得
    let fanUsersMap: { [key: string]: any } = {};
    if (uniqueFanUserIds.length > 0) {
      const { data: fanUsers, error: fanError } = await supabase
        .from('users')
        .select('id, display_name, profile_image_url, bio')
        .in('id', uniqueFanUserIds);

      if (fanError) {
        console.error('❌ Fan users取得エラー:', fanError);
      } else if (fanUsers && fanUsers.length > 0) {
        // マップを作成して高速検索可能にする
        fanUsersMap = fanUsers.reduce((acc: any, user: any) => {
          acc[String(user.id)] = user;
          return acc;
        }, {});
      }
    }

    // TalkSession形式に変換
    // インフルエンサー視点では、influencerオブジェクトに落札者（ファン）の情報を設定
    const talkSessions: TalkSession[] = callSlots.map((callSlot: any) => {
      const purchasedSlot = callSlot.purchased_slots?.[0]; // 1:1関係
      
      // call_slotsからuser_id（ホスト=自分）とfan_user_id（落札者）を取得
      const hostUserId = callSlot.user_id; // ホスト（インフルエンサー）のID
      const fanUserId = callSlot.fan_user_id; // 落札者（ファン）のID
      const fan = fanUserId ? fanUsersMap[String(fanUserId)] : null;
      const host = callSlot.influencer; // user_idリレーションから取得したホスト情報

      // 予定のTalkか過去のTalkかを判定
      const now = new Date();
      const talkDate = new Date(callSlot.scheduled_start_time);
      const isUpcoming = talkDate > now && purchasedSlot?.call_status !== 'completed';

      // 詳細ログ: 各Talk枠について、call_slotsとusersテーブルの情報をまとめて出力
      console.log('📋 [getInfluencerHostedTalks] Talk枠情報:', {
        '=== Talk枠基本情報 ===': '',
        'Talk枠ID': callSlot.id,
        'Talk枠タイトル': callSlot.title,
        '予定開始時刻': callSlot.scheduled_start_time,
        '',
        '=== call_slotsテーブルから取得 ===': '',
        'call_slots.user_id (インフルエンサー)': hostUserId,
        'call_slots.fan_user_id (ファン)': fanUserId,
        '',
        '=== usersテーブルから取得 - インフルエンサー情報 ===': '',
        'users.id': host?.id,
        'users.display_name': host?.display_name,
        'users.profile_image_url': host?.profile_image_url,
        'users.bio': host?.bio,
        'users.average_rating': host?.average_rating,
        '',
        '=== usersテーブルから取得 - ファン情報 ===': '',
        'users.id': fan?.id || '(未取得)',
        'users.display_name': fan?.display_name || '(未取得)',
        'users.profile_image_url': fan?.profile_image_url || '(未取得)',
        'users.bio': fan?.bio || '(未取得)',
        'fanUsersMapに存在': fanUserId ? (fanUsersMap[String(fanUserId)] ? 'あり' : 'なし') : 'N/A',
        '',
        '=== purchased_slots情報 ===': '',
        'purchased_slot.id': purchasedSlot?.id,
        'purchased_slot.call_status': purchasedSlot?.call_status,
        'purchased_slot.winning_bid_amount': purchasedSlot?.winning_bid_amount,
      });

      const talkSession = {
        id: callSlot.id,
        purchased_slot_id: purchasedSlot?.id,
        influencer_id: hostUserId, // ホスト（インフルエンサー）のID
        influencer: {
          id: fanUserId || '', // 落札者（ファン）のID（インフルエンサー視点では「相手」）
          name: fan?.display_name || '購入者',
          username: fan?.display_name || '購入者',
          avatar_url: fan?.profile_image_url || '/images/default-avatar.png',
          description: fan?.bio || '',
          follower_count: 0,
          total_earned: 0,
          total_talks: 0,
          rating: 0,
          created_at: new Date().toISOString(),
        },
        title: callSlot.title || 'Talk枠',
        description: callSlot.description || '',
        host_message: callSlot.description || `${fan?.display_name || '購入者'}さんとのTalk`,
        start_time: callSlot.scheduled_start_time || new Date().toISOString(),
        end_time: callSlot.scheduled_start_time
          ? new Date(new Date(callSlot.scheduled_start_time).getTime() + (callSlot.duration_minutes || 30) * 60000).toISOString()
          : new Date().toISOString(),
        auction_end_time: callSlot.scheduled_start_time || new Date().toISOString(),
        starting_price: purchasedSlot?.winning_bid_amount || 0,
        current_highest_bid: purchasedSlot?.winning_bid_amount || 0,
        status: isUpcoming ? 'won' : 'completed',
        created_at: purchasedSlot?.purchased_at || new Date().toISOString(),
        detail_image_url: callSlot.thumbnail_url || host?.profile_image_url || '/images/talks/default.jpg',
        is_female_only: false,
      };

      // 詳細ログ: 最終的なTalkSessionオブジェクト
      console.log('✅ [getInfluencerHostedTalks] 最終TalkSessionオブジェクト:', {
        'Talk枠ID': talkSession.id,
        'purchased_slot_id': talkSession.purchased_slot_id,
        'インフルエンサーuser_id (talkSession.influencer_id)': talkSession.influencer_id,
        'ファンuser_id (talkSession.influencer.id)': talkSession.influencer.id,
        '表示名 (talkSession.influencer.name)': talkSession.influencer.name,
        '表示画像URL (talkSession.influencer.avatar_url)': talkSession.influencer.avatar_url,
        'Talk枠タイトル': talkSession.title,
        '背景画像URL (talkSession.detail_image_url)': talkSession.detail_image_url,
        '開始時刻': talkSession.start_time,
        'ステータス': talkSession.status,
      });

      return talkSession;
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
