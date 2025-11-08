import { supabase } from '../lib/supabase';

export interface InfluencerRanking {
  id: string;
  display_name: string;
  profile_image_url: string;
  total_earned: number;
  total_talks: number;
  average_rating: number;
}

export interface BidderRanking {
  id: string;
  display_name: string;
  profile_image_url: string;
  total_spent: number;
  successful_bids: number;
}

export interface RankingStats {
  total_transaction_amount: number;
  total_talks_completed: number;
  average_rating: number;
}

// インフルエンサーランキングを取得（総獲得金額順）
export const getInfluencerRankings = async (limit: number = 10): Promise<InfluencerRanking[]> => {
  try {
    console.log('🔍 インフルエンサーランキング取得開始');

    // 1. purchased_slotsからcall_slotsを結合してuser_idと価格を取得
    const { data: purchases, error: purchasesError } = await supabase
      .from('purchased_slots')
      .select(`
        winning_bid_amount,
        call_slots!inner (
          user_id
        )
      `);

    if (purchasesError) {
      console.error('❌ Error fetching purchases:', purchasesError);
      throw purchasesError;
    }

    console.log('📊 purchased_slots取得結果:', {
      count: purchases?.length || 0,
      data: purchases?.slice(0, 3) // 最初の3件を表示
    });

    if (!purchases || purchases.length === 0) {
      console.log('⚠️ No purchases found');
      return [];
    }

    // 2. user_idごとに集計
    const userStats = purchases.reduce((acc, purchase: any) => {
      const userId = purchase.call_slots?.user_id;
      if (!userId) return acc;

      if (!acc[userId]) {
        acc[userId] = {
          total_earned: 0,
          total_talks: 0,
        };
      }
      acc[userId].total_earned += purchase.winning_bid_amount || 0;
      acc[userId].total_talks += 1;
      return acc;
    }, {} as Record<string, { total_earned: number; total_talks: number }>);

    console.log('User stats:', userStats);

    // 3. ユーザー情報を取得（usersテーブルから）
    const userIds = Object.keys(userStats);
    if (userIds.length === 0) {
      return [];
    }

    console.log('Looking up users:', userIds);

    // usersテーブルから情報を取得（インフルエンサーのみ）
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, display_name, profile_image_url, average_rating')
      .in('id', userIds)
      .eq('is_influencer', true);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    if (!users || users.length === 0) {
      console.log('No influencer users found for user IDs:', userIds);
      return [];
    }

    console.log('Found users:', users);

    // 4. ランキングデータを構築
    const rankings: InfluencerRanking[] = users.map((user: any) => ({
      id: user.id,
      display_name: user.display_name || 'Unknown',
      profile_image_url: user.profile_image_url || '',
      average_rating: user.average_rating || 0,
      total_earned: userStats[user.id].total_earned,
      total_talks: userStats[user.id].total_talks,
    }));

    // 5. 総獲得金額でソートしてlimit数だけ返す
    return rankings
      .sort((a, b) => b.total_earned - a.total_earned)
      .slice(0, limit);

  } catch (error: any) {
    console.error('Error fetching influencer rankings:', error);
    throw error;
  }
};

// ビッダーランキングを取得（総支払額順）
export const getBidderRankings = async (limit: number = 10): Promise<BidderRanking[]> => {
  try {
    console.log('🔍 ビッダーランキング取得開始');

    // 1. purchased_slotsから支払いデータを取得
    const { data: purchases, error: purchasesError } = await supabase
      .from('purchased_slots')
      .select('fan_user_id, winning_bid_amount');

    if (purchasesError) {
      console.error('❌ Error fetching purchases for bidders:', purchasesError);
      throw purchasesError;
    }

    console.log('📊 ビッダーランキング用データ取得結果:', {
      count: purchases?.length || 0,
      data: purchases?.slice(0, 3)
    });

    if (!purchases || purchases.length === 0) {
      console.log('⚠️ No purchases found for bidders');
      return [];
    }

    console.log(`✅ Found ${purchases.length} purchases for bidder rankings`);

    // 2. ユーザーごとに集計
    const userStats = purchases.reduce((acc, purchase) => {
      const userId = purchase.fan_user_id;
      if (!acc[userId]) {
        acc[userId] = {
          total_spent: 0,
          successful_bids: 0,
        };
      }
      acc[userId].total_spent += purchase.winning_bid_amount || 0;
      acc[userId].successful_bids += 1;
      return acc;
    }, {} as Record<string, { total_spent: number; successful_bids: number }>);

    // 3. ユーザー情報を取得
    const userIds = Object.keys(userStats);
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, display_name, profile_image_url')
      .in('id', userIds);

    if (usersError) throw usersError;

    if (!users || users.length === 0) {
      return [];
    }

    // 4. ランキングデータを構築
    const rankings: BidderRanking[] = users.map(user => ({
      id: user.id,
      display_name: user.display_name || 'Unknown',
      profile_image_url: user.profile_image_url || '',
      total_spent: userStats[user.id].total_spent,
      successful_bids: userStats[user.id].successful_bids,
    }));

    // 5. 総支払額でソートしてlimit数だけ返す
    return rankings
      .sort((a, b) => b.total_spent - a.total_spent)
      .slice(0, limit);

  } catch (error: any) {
    console.error('Error fetching bidder rankings:', error);
    throw error;
  }
};

// プラットフォーム全体の統計を取得
export const getRankingStats = async (): Promise<RankingStats> => {
  try {
    console.log('🔍 統計データ取得開始');

    // 総取引額と完了したTalk数を取得
    const { data: purchases, error: purchasesError } = await supabase
      .from('purchased_slots')
      .select('winning_bid_amount');

    if (purchasesError) {
      console.error('❌ Error fetching purchases for stats:', purchasesError);
      throw purchasesError;
    }

    console.log('📊 統計用データ取得結果:', {
      count: purchases?.length || 0,
      data: purchases?.slice(0, 3)
    });

    const totalTransactionAmount = purchases?.reduce((sum, p) => sum + (p.winning_bid_amount || 0), 0) || 0;
    const totalTalksCompleted = purchases?.length || 0;

    console.log('✅ 統計計算結果:', { totalTransactionAmount, totalTalksCompleted, purchaseCount: purchases?.length || 0 });

    // 平均評価を取得（全インフルエンサーの平均）
    const { data: influencers, error: influencersError } = await supabase
      .from('users')
      .select('average_rating')
      .eq('is_influencer', true);

    if (influencersError) throw influencersError;

    const averageRating = influencers && influencers.length > 0
      ? influencers.reduce((sum, i) => sum + (i.average_rating || 0), 0) / influencers.length
      : 0;

    return {
      total_transaction_amount: totalTransactionAmount,
      total_talks_completed: totalTalksCompleted,
      average_rating: Number(averageRating.toFixed(1)),
    };

  } catch (error: any) {
    console.error('Error fetching ranking stats:', error);
    throw error;
  }
};
