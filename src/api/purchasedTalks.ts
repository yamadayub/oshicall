import { supabase } from '../lib/supabase';
import { TalkSession } from '../types';

export const getPurchasedTalks = async (userId: string) => {
  try {
    console.log('🚀 [getPurchasedTalks] 開始:', { userId });
    
    // 新スキーマ: call_slotsから直接fan_user_idでフィルタリング
    // purchased_slotsはリレーションではなく直接クエリで取得（RLS問題を回避）
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
        )
      `)
      .eq('fan_user_id', userId)
      .is('deleted_at', null)
      .order('scheduled_start_time', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    // データが空の場合は空の配列を返す（エラーではない）
    if (!callSlots || callSlots.length === 0) {
      return [];
    }

    // call_slot_idのリストを取得
    const callSlotIds = callSlots.map((cs: any) => cs.id);
    
    console.log('🔍 [getPurchasedTalks] call_slots取得結果:', {
      'callSlots件数': callSlots.length,
      'callSlotIds': callSlotIds,
      'userId': userId,
    });

    // purchased_slotsを直接クエリで取得（RLSが正しく適用される）
    // RLSポリシーがget_current_user_id()を使用しているため、.eq('fan_user_id', userId)は不要
    // RLSポリシーが自動的に現在のユーザーのpurchased_slotsのみを返す
    const { data: purchasedSlots, error: purchasedError } = await supabase
      .from('purchased_slots')
      .select('id, call_slot_id, purchased_at, call_status, winning_bid_amount')
      .in('call_slot_id', callSlotIds);

    console.log('🔍 [getPurchasedTalks] purchased_slots取得結果:', {
      'purchasedSlots件数': purchasedSlots?.length || 0,
      'purchasedSlots': purchasedSlots,
      'purchasedError': purchasedError,
      'callSlotIds': callSlotIds,
      'userId': userId,
      '問題のcall_slot_id (85a47898-0f4b-44db-ba2c-683348fc97d5) がcallSlotIdsに含まれているか': callSlotIds.includes('85a47898-0f4b-44db-ba2c-683348fc97d5'),
      '問題のcall_slot_idのpurchased_slotが取得できているか': purchasedSlots?.find((ps: any) => ps.call_slot_id === '85a47898-0f4b-44db-ba2c-683348fc97d5'),
    });

    if (purchasedError) {
      console.error('❌ [getPurchasedTalks] purchased_slots取得エラー:', purchasedError);
      // エラーが発生しても続行（purchased_slotsが取得できない場合でもcall_slotsは表示）
    }

    // purchased_slotsをcall_slot_idでマップ化
    const purchasedSlotsMap: { [key: string]: any } = {};
    if (purchasedSlots && purchasedSlots.length > 0) {
      console.log('🔧 [getPurchasedTalks] purchasedSlotsMap作成開始:', {
        'purchasedSlots件数': purchasedSlots.length,
        'purchasedSlots詳細': purchasedSlots.map((ps: any) => ({
          id: ps.id,
          call_slot_id: ps.call_slot_id,
          call_slot_id型: typeof ps.call_slot_id,
        })),
      });
      
      purchasedSlots.forEach((ps: any) => {
        const key = String(ps.call_slot_id); // 確実に文字列に変換
        purchasedSlotsMap[key] = ps;
        console.log('🔧 [getPurchasedTalks] マップに追加:', {
          'key': key,
          'key型': typeof key,
          'purchased_slot_id': ps.id,
          'call_slot_id': ps.call_slot_id,
        });
      });
      
      console.log('✅ [getPurchasedTalks] purchasedSlotsMap作成完了:', {
        '取得件数': purchasedSlots.length,
        'マップのキー': Object.keys(purchasedSlotsMap),
        'マップのキーの型': Object.keys(purchasedSlotsMap).map(k => typeof k),
        '問題のcall_slot_id (85a47898-0f4b-44db-ba2c-683348fc97d5) がマップに存在するか': '85a47898-0f4b-44db-ba2c-683348fc97d5' in purchasedSlotsMap,
        '問題のcall_slot_idの値': purchasedSlotsMap['85a47898-0f4b-44db-ba2c-683348fc97d5'],
        'マップの内容': Object.entries(purchasedSlotsMap).map(([k, v]: [string, any]) => ({
          call_slot_id: k,
          purchased_slot_id: v.id,
        })),
      });
    } else {
      console.warn('⚠️ [getPurchasedTalks] purchased_slotsが取得できませんでした:', {
        'callSlotIds': callSlotIds,
        'callSlotIds型': callSlotIds.map((id: any) => typeof id),
        '問題のcall_slot_id (85a47898-0f4b-44db-ba2c-683348fc97d5) がcallSlotIdsに含まれているか': callSlotIds.includes('85a47898-0f4b-44db-ba2c-683348fc97d5'),
        'userId': userId,
        'purchasedSlots': purchasedSlots,
        'purchasedError': purchasedError,
      });
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
      
      const mapKey = String(callSlot.id); // 確実に文字列に変換
      const purchasedSlot = purchasedSlotsMap[mapKey]; // マップから取得
      
      console.log('🔍 [getPurchasedTalks] purchasedSlot取得:', {
        'callSlot.id': callSlot.id,
        'callSlot.id型': typeof callSlot.id,
        'mapKey': mapKey,
        'mapKey型': typeof mapKey,
        'purchasedSlot': purchasedSlot,
        'purchased_slot_id': purchasedSlot?.id,
        'マップに存在': purchasedSlot ? 'あり' : 'なし',
        'マップの全キー': Object.keys(purchasedSlotsMap),
        '問題のcall_slot_id (85a47898-0f4b-44db-ba2c-683348fc97d5) の場合': callSlot.id === '85a47898-0f4b-44db-ba2c-683348fc97d5' ? {
          'マップに存在': '85a47898-0f4b-44db-ba2c-683348fc97d5' in purchasedSlotsMap,
          'マップの値': purchasedSlotsMap['85a47898-0f4b-44db-ba2c-683348fc97d5'],
        } : 'N/A',
      });

      // call_slotsからuser_id（インフルエンサー）とfan_user_id（ファン）を取得
      const influencerUserId = callSlot.user_id; // インフルエンサーのuser_id
      const fanUserId = userId; // 現在のユーザー（ファン）のuser_id

      // 予定のTalkか過去のTalkかを判定
      const now = new Date();
      const talkDate = new Date(callSlot.scheduled_start_time);
      const talkEndTime = new Date(new Date(callSlot.scheduled_start_time).getTime() + (callSlot.duration_minutes || 30) * 60000);
      const isUpcoming = talkEndTime > now && purchasedSlot?.call_status !== 'completed';

      // 詳細ログ: 各Talk枠について、call_slotsとusersテーブルの情報をまとめて出力
      console.log('📋 [getPurchasedTalks] Talk枠情報:');
      console.log('  === Talk枠基本情報 ===');
      console.log('  Talk枠ID:', callSlot.id);
      console.log('  Talk枠タイトル:', callSlot.title);
      console.log('  予定開始時刻:', callSlot.scheduled_start_time);
      console.log('  === call_slotsテーブルから取得 ===');
      console.log('  call_slots.user_id (インフルエンサー):', influencerUserId);
      console.log('  call_slots.fan_user_id (ファン):', fanUserId);
      console.log('  === usersテーブルから取得 - インフルエンサー情報 ===');
      console.log('  users.id:', influencer?.id);
      console.log('  users.display_name:', influencer?.display_name);
      console.log('  users.profile_image_url:', influencer?.profile_image_url);
      console.log('  users.average_rating:', influencer?.average_rating);
      console.log('  === usersテーブルから取得 - ファン情報 ===');
      console.log('  users.id:', fanUser?.id || '(未取得)');
      console.log('  users.display_name:', fanUser?.display_name || '(未取得)');
      console.log('  users.profile_image_url:', fanUser?.profile_image_url || '(未取得)');
      console.log('  users.bio:', fanUser?.bio || '(未取得)');

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
        status: (isUpcoming ? 'won' : 'completed') as TalkSession['status'],
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
  return allTalks.filter(talk => talk.status === 'won');
};

export const getCompletedPurchasedTalks = async (userId: string) => {
  const allTalks = await getPurchasedTalks(userId);
  return allTalks.filter(talk => talk.status === 'completed');
};

// インフルエンサー用：ホストするTalk（販売済みスロット + オークション期間中のスロット）を取得
export const getInfluencerHostedTalks = async (userId: string) => {
  try {
    // 新スキーマ: call_slotsからuser_id（ホスト）とfan_user_id（落札者）を取得
    // user_id（インフルエンサー）でフィルタリングし、以下を取得：
    // 1. fan_user_idが存在する（落札済み）スロット
    // 2. オークション期間中のスロット（fan_user_idがnullでも、オークションが存在する）
    const { data: callSlots, error } = await supabase
      .from('call_slots')
      .select(`
        id,
        title,
        description,
        scheduled_start_time,
        duration_minutes,
        starting_price,
        thumbnail_url,
        is_published,
        user_id,
        fan_user_id,
        end_time,
        status,
        influencer:user_id (
          id,
          display_name,
          profile_image_url,
          bio,
          average_rating
        ),
        auctions (
          id,
          status,
          end_time,
          auction_end_time,
          current_highest_bid
        )
      `)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('scheduled_start_time', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    // データが空の場合は空の配列を返す
    if (!callSlots || callSlots.length === 0) {
      console.log('⚠️ [getInfluencerHostedTalks] call_slotsが空です');
      return [];
    }

    // フィルタリング: オークション期間中または落札済みのスロットのみを取得
    const filteredCallSlots = callSlots.filter((callSlot: any) => {
      const auction = Array.isArray(callSlot.auctions) ? callSlot.auctions[0] : callSlot.auctions;
      // オークションが存在する場合（statusは問わない）
      const hasAuction = auction !== null && auction !== undefined;
      // 落札済みのスロット
      const hasPurchasedSlot = callSlot.fan_user_id !== null && callSlot.fan_user_id !== undefined;
      // 公開済みのスロット（オークションが開始される前でも表示）
      const hasPublishedSlot = callSlot.is_published === true;

      // オークションが存在する、または落札済み、または公開済みのスロットを表示
      return hasAuction || hasPurchasedSlot || hasPublishedSlot;
    });

    console.log(`📊 [getInfluencerHostedTalks] フィルタリング結果: ${filteredCallSlots.length}/${callSlots.length}件`);

    if (filteredCallSlots.length === 0) {
      return [];
    }

    // call_slot_idのリストを取得
    const callSlotIds = filteredCallSlots.map((cs: any) => cs.id);

    // purchased_slotsを直接クエリで取得（RLSが正しく適用される）
    // RLSポリシーがget_current_user_id()を使用しているため、.eq('influencer_user_id', userId)は不要
    // RLSポリシーが自動的に現在のユーザーのpurchased_slotsのみを返す
    const { data: purchasedSlots, error: purchasedError } = await supabase
      .from('purchased_slots')
      .select('id, call_slot_id, fan_user_id, purchased_at, call_status, winning_bid_amount')
      .in('call_slot_id', callSlotIds);

    if (purchasedError) {
      console.error('❌ [getInfluencerHostedTalks] purchased_slots取得エラー:', purchasedError);
      // エラーが発生しても続行（purchased_slotsが取得できない場合でもcall_slotsは表示）
    }

    // purchased_slotsをcall_slot_idでマップ化
    const purchasedSlotsMap: { [key: string]: any } = {};
    if (purchasedSlots && purchasedSlots.length > 0) {
      purchasedSlots.forEach((ps: any) => {
        purchasedSlotsMap[ps.call_slot_id] = ps;
      });
      console.log('✅ [getInfluencerHostedTalks] purchasedSlotsMap作成完了:', {
        '取得件数': purchasedSlots.length,
        'マップのキー': Object.keys(purchasedSlotsMap),
        'マップの内容': Object.entries(purchasedSlotsMap).map(([k, v]: [string, any]) => ({
          call_slot_id: k,
          purchased_slot_id: v.id,
        })),
      });
    } else {
      console.warn('⚠️ [getInfluencerHostedTalks] purchased_slotsが取得できませんでした:', {
        'callSlotIds': callSlotIds,
        'userId': userId,
        'purchasedSlots': purchasedSlots,
        'purchasedError': purchasedError,
      });
    }

    // call_slotsからfan_user_idのリストを取得（フィルタリング後のスロットから）
    const fanUserIds = filteredCallSlots
      .map((cs: any) => cs.fan_user_id)
      .filter((id: any) => id !== null && id !== undefined && id !== '');

    // 重複を除去
    const uniqueFanUserIds = [...new Set(fanUserIds)];

    console.log('🔍 [getInfluencerHostedTalks] ファン情報取得準備:', {
      'call_slotsから取得したfan_user_idリスト': fanUserIds,
      '重複除去後のfan_user_idリスト': uniqueFanUserIds,
      'リストの長さ': uniqueFanUserIds.length,
    });

    // usersテーブルからfan_user_idをキーにuser情報を取得
    let fanUsersMap: { [key: string]: any } = {};
    if (uniqueFanUserIds.length > 0) {
      console.log('🔍 [getInfluencerHostedTalks] usersテーブルからファン情報を取得開始:', {
        '検索するuser_idリスト': uniqueFanUserIds,
      });

      const { data: fanUsers, error: fanError } = await supabase
        .from('users')
        .select('id, display_name, profile_image_url, bio')
        .in('id', uniqueFanUserIds);

      if (fanError) {
        console.error('❌ [getInfluencerHostedTalks] Fan users取得エラー:', {
          'エラーコード': fanError.code,
          'エラーメッセージ': fanError.message,
          'エラー詳細': fanError.details,
          'エラーヒント': fanError.hint,
          '検索したuser_idリスト': uniqueFanUserIds,
          '考えられる原因': fanError.code === 'PGRST301' || fanError.code === '42501'
            ? 'RLS（Row Level Security）ポリシーによりアクセスが拒否されています。sql/fixes/add_influencer_view_fan_from_call_slots.sqlを実行してください。'
            : 'その他のエラー',
        });
      } else {
        console.log('✅ [getInfluencerHostedTalks] usersテーブルから取得したファン情報:', {
          '取得件数': fanUsers?.length || 0,
          '取得したユーザー': fanUsers?.map((u: any) => ({ id: u.id, display_name: u.display_name })) || [],
        });

        if (fanUsers && fanUsers.length > 0) {
          // マップを作成して高速検索可能にする
          fanUsersMap = fanUsers.reduce((acc: any, user: any) => {
            acc[String(user.id)] = user;
            return acc;
          }, {});

          console.log('✅ [getInfluencerHostedTalks] fanUsersMap作成完了:', {
            'マップのキー': Object.keys(fanUsersMap),
            'マップの内容': Object.entries(fanUsersMap).map(([k, v]: [string, any]) => ({ key: k, id: v.id, display_name: v.display_name })),
          });
        } else {
          console.warn('⚠️ [getInfluencerHostedTalks] usersテーブルからファン情報が取得できませんでした:', {
            '検索したuser_idリスト': uniqueFanUserIds,
            '取得結果': fanUsers,
          });
        }
      }
    }

    // TalkSession形式に変換
    // インフルエンサー視点では、influencerオブジェクトに落札者（ファン）の情報を設定
    const talkSessions: TalkSession[] = filteredCallSlots.map((callSlot: any) => {
      const purchasedSlot = purchasedSlotsMap[callSlot.id]; // マップから取得
      const auction = Array.isArray(callSlot.auctions) ? callSlot.auctions[0] : callSlot.auctions;
      
      console.log('🔍 [getInfluencerHostedTalks] purchasedSlot取得:', {
        'callSlot.id': callSlot.id,
        'purchasedSlot': purchasedSlot,
        'purchased_slot_id': purchasedSlot?.id,
        'マップに存在': purchasedSlotsMap[callSlot.id] ? 'あり' : 'なし',
      });

      // call_slotsからuser_id（ホスト=自分）とfan_user_id（落札者）を取得
      const hostUserId = callSlot.user_id; // ホスト（インフルエンサー）のID
      const fanUserId = callSlot.fan_user_id; // 落札者（ファン）のID
      const fan = fanUserId ? fanUsersMap[String(fanUserId)] : null;
      const host = callSlot.influencer; // user_idリレーションから取得したホスト情報

      // 予定のTalkか過去のTalkかを判定
      const now = new Date();
      const talkDate = new Date(callSlot.scheduled_start_time);
      const talkEndTime = new Date(new Date(callSlot.scheduled_start_time).getTime() + (callSlot.duration_minutes || 30) * 60000);

      // オークション期間中かどうかを判定
      const isAuctionActive = auction && (auction.status === 'active' || auction.status === 'scheduled');
      const isAuctionEnded = auction && auction.status === 'ended';
      const isUpcoming = (talkEndTime > now && purchasedSlot?.call_status !== 'completed') || isAuctionActive;

      // 詳細ログ: 各Talk枠について、call_slotsとusersテーブルの情報をまとめて出力
      console.log('📋 [getInfluencerHostedTalks] Talk枠情報:');
      console.log('  === Talk枠基本情報 ===');
      console.log('  Talk枠ID:', callSlot.id);
      console.log('  Talk枠タイトル:', callSlot.title);
      console.log('  予定開始時刻:', callSlot.scheduled_start_time);
      console.log('  === call_slotsテーブルから取得 ===');
      console.log('  call_slots.user_id (インフルエンサー):', hostUserId);
      console.log('  call_slots.fan_user_id (ファン):', fanUserId);
      console.log('  === usersテーブルから取得 - インフルエンサー情報 ===');
      console.log('  users.id:', host?.id);
      console.log('  users.display_name:', host?.display_name);
      console.log('  users.profile_image_url:', host?.profile_image_url);
      console.log('  users.bio:', host?.bio);
      console.log('  users.average_rating:', host?.average_rating);
      console.log('  === usersテーブルから取得 - ファン情報 ===');
      console.log('  users.id:', fan?.id || '(未取得)');
      console.log('  users.display_name:', fan?.display_name || '(未取得)');
      console.log('  users.profile_image_url:', fan?.profile_image_url || '(未取得)');
      console.log('  users.bio:', fan?.bio || '(未取得)');
      console.log('  fanUsersMapに存在:', fanUserId ? (fanUsersMap[String(fanUserId)] ? 'あり' : 'なし') : 'N/A');
      console.log('  === purchased_slots情報 ===');
      console.log('  purchased_slot (from map):', purchasedSlot);
      console.log('  purchased_slot.id:', purchasedSlot?.id);
      console.log('  purchased_slot.call_status:', purchasedSlot?.call_status);
      console.log('  purchased_slot.winning_bid_amount:', purchasedSlot?.winning_bid_amount);
      console.log('  === オークション情報 ===');
      console.log('  auction.status:', auction?.status);
      console.log('  isAuctionActive:', isAuctionActive);
      console.log('  isAuctionEnded:', isAuctionEnded);
      console.log('  === デバッグ情報 ===');
      console.log('  fanUserId (call_slot.fan_user_id):', fanUserId);
      console.log('  fanUsersMap[fanUserId]:', fanUsersMap[String(fanUserId)]);
      console.log('  fanUsersMap全体のキー:', Object.keys(fanUsersMap));

      // status判定ロジック:
      // 1. オークションがアクティブな場合 → 'active'
      // 2. purchasedSlotが存在する場合：
      //    - Talkの終了時刻（talkEndTime）を基準に判定
      //    - talkEndTime > now の場合 → 'won'（予定されているTalk）
      //    - talkEndTime <= now の場合 → 'completed'（完了済みのTalk）
      // 3. purchasedSlotが存在しない場合 → 'upcoming'
      // 注意: オークションが終了しているかどうかは、statusの判定には影響しない
      //       Talkの終了時刻のみを基準にする
      let status: TalkSession['status'];
      if (isAuctionActive) {
        status = 'active';
      } else if (purchasedSlot) {
        // purchasedSlotが存在する場合
        // Talkの終了時刻（talkEndTime）を基準に判定
        if (talkEndTime > now) {
          // Talkがまだ終了していない場合
          status = 'won';
        } else {
          // Talkが終了している場合
          status = 'completed';
        }
      } else {
        // purchasedSlotが存在しない場合
        status = 'upcoming';
      }

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
        end_time: callSlot.end_time || callSlot.scheduled_start_time
          ? new Date(new Date(callSlot.scheduled_start_time).getTime() + (callSlot.duration_minutes || 30) * 60000).toISOString()
          : new Date().toISOString(),
        auction_end_time: auction?.auction_end_time || auction?.end_time || callSlot.scheduled_start_time || new Date().toISOString(),
        starting_price: purchasedSlot?.winning_bid_amount || auction?.current_highest_bid || callSlot.starting_price || 0,
        current_highest_bid: purchasedSlot?.winning_bid_amount || auction?.current_highest_bid || callSlot.starting_price || 0,
        status: status,
        call_status: purchasedSlot?.call_status, // purchased_slots.call_statusを追加
        created_at: purchasedSlot?.purchased_at || new Date().toISOString(),
        detail_image_url: callSlot.thumbnail_url || host?.profile_image_url || '/images/talks/default.jpg',
        is_female_only: false,
        auction_status: auction?.status, // オークションステータスを追加
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
    // オークション期間中のTalk枠は常に表示（auction_statusがactive/scheduled）
    const isAuctionActive = talk.auction_status === 'active' || talk.auction_status === 'scheduled';
    if (isAuctionActive) {
      return true;
    }

    // 落札済みのTalk枠の場合：statusがwonで、end_timeを迎えていない
    // または、まだ落札されていないが公開されている枠（upcoming）
    const isActiveStatus = talk.status === 'won' || talk.status === 'upcoming';
    const hasNotEnded = new Date(talk.end_time) > now;

    return isActiveStatus && hasNotEnded;
  });
};

export const getCompletedHostedTalks = async (userId: string) => {
  const allTalks = await getInfluencerHostedTalks(userId);
  const now = new Date();

  return allTalks.filter(talk => {
    // 以下のいずれかの条件を満たす場合、「過去の実績」タブに表示：
    // 1. call_slotsのstatusがcompleted
    // 2. call_slotsのstatusがplannedまたはliveだが、end_timeを過ぎている
    const isCompleted = talk.status === 'completed';
    const hasEnded = new Date(talk.end_time) <= now;

    return isCompleted || hasEnded;
  });
};
