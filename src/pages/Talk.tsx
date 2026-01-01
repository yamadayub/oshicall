import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, History, Calendar, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getUpcomingPurchasedTalks, getCompletedPurchasedTalks, getUpcomingHostedTalks, getCompletedHostedTalks } from '../api/purchasedTalks';
import TalkCard from '../components/TalkCard';
import { TalkSession } from '../types';
import { supabase } from '../lib/supabase';

export default function Talk() {
  const navigate = useNavigate();
  const { supabaseUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
  const [upcomingTalks, setUpcomingTalks] = useState<TalkSession[]>([]);
  const [pastTalks, setPastTalks] = useState<TalkSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isInfluencer = supabaseUser?.is_influencer || false;

  useEffect(() => {
    const loadTalks = async () => {
      if (!supabaseUser?.id) return;

      try {
        setIsLoading(true);
        setError(null);

        // インフルエンサーかファンかで取得する関数を切り替え
        const [upcoming, completed] = await Promise.all([
          isInfluencer
            ? getUpcomingHostedTalks(supabaseUser.id)
            : getUpcomingPurchasedTalks(supabaseUser.id),
          isInfluencer
            ? getCompletedHostedTalks(supabaseUser.id)
            : getCompletedPurchasedTalks(supabaseUser.id)
        ]);

        setUpcomingTalks(upcoming);
        setPastTalks(completed);

        // デバッグログ：インフルエンサー視点でのデータ確認
        if (isInfluencer && upcoming.length > 0) {
          console.log('🔍 インフルエンサー視点 - 予定Talk:', upcoming.map(t => ({
            id: t.id,
            title: t.title,
            influencer_id: t.influencer.id,
            influencer_name: t.influencer.name,
            purchased_slot_id: t.purchased_slot_id,
          })));
        }
      } catch (err) {
        console.error('Talk取得エラー:', err);
        // 実際のデータベースエラーの場合のみエラーを表示
        if (err instanceof Error && (
          err.message.includes('database') ||
          err.message.includes('network') ||
          err.message.includes('connection') ||
          err.message.includes('timeout')
        )) {
          setError('データの取得に失敗しました');
        } else {
          // その他のエラー（空のデータなど）は正常な状態として扱う
          setError(null);
        }
        setUpcomingTalks([]);
        setPastTalks([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadTalks();
  }, [supabaseUser?.id, isInfluencer]);



  // ... (existing imports)

  const handleTalkSelect = async (talk: TalkSession) => {
    console.log('🔵 [handleTalkSelect] Talk枠をタップ:', {
      talkId: talk.id,
      purchased_slot_id: talk.purchased_slot_id,
      status: talk.status,
      auction_status: talk.auction_status,
      userId: supabaseUser?.id,
      isInfluencer,
    });

    // Navigate to the call page if purchased_slot_id exists
    if (talk.purchased_slot_id) {
      console.log('✅ [handleTalkSelect] purchased_slot_idが存在します。Talk画面に遷移:', talk.purchased_slot_id);
      navigate(`/call/${talk.purchased_slot_id}`);
      return;
    }

    console.log('⚠️ [handleTalkSelect] purchased_slot_idが存在しません。purchased_slotsテーブルから検索します...');

    // if purchased_slot_id is missing, try to find it (for both influencers and fans)
    // これは通常発生しないはず（purchasedTalks.tsで取得済み）が、念のためフォールバック処理を実装
    try {
      // まず、call_slot_idだけで検索（RLSが適用される）
      const query = supabase
        .from('purchased_slots')
        .select('id, fan_user_id, influencer_user_id')
        .eq('call_slot_id', talk.id);

      const { data: allPurchasedSlots, error: queryError } = await query;

      console.log('🔍 [handleTalkSelect] purchased_slots検索結果:', {
        'talkId': talk.id,
        'userId': supabaseUser?.id,
        'isInfluencer': isInfluencer,
        'allPurchasedSlots': allPurchasedSlots,
        '取得件数': allPurchasedSlots?.length || 0,
        'queryError': queryError,
      });

      if (queryError) {
        console.error('❌ [handleTalkSelect] purchased_slots検索エラー:', {
          error: queryError,
          errorCode: queryError.code,
          errorMessage: queryError.message,
          talkId: talk.id,
          userId: supabaseUser?.id,
          isInfluencer,
        });
        
        // RLSエラー（PGRST301）の場合は、データが存在しない可能性が高い
        if (queryError.code === 'PGRST301' || queryError.code === '42501') {
          console.warn('⚠️ [handleTalkSelect] RLSエラー: purchased_slotsにアクセスできません。オークション完了画面に遷移します。');
          navigate(`/talk/${talk.id}`);
          return;
        }
        
        // その他のエラーの場合もオークション完了画面に遷移
        navigate(`/talk/${talk.id}`);
        return;
      }

      // 取得したpurchased_slotsから、現在のユーザーに関連するものを探す
      let purchasedSlot = null;
      if (allPurchasedSlots && allPurchasedSlots.length > 0) {
        console.log('🔍 [handleTalkSelect] purchased_slotsから検索:', {
          'allPurchasedSlots': allPurchasedSlots.map((ps: any) => ({
            id: ps.id,
            fan_user_id: ps.fan_user_id,
            influencer_user_id: ps.influencer_user_id,
          })),
          'currentUserId': supabaseUser?.id,
        });

        if (isInfluencer && supabaseUser?.id) {
          purchasedSlot = allPurchasedSlots.find(ps => ps.influencer_user_id === supabaseUser.id);
          console.log('🔍 [handleTalkSelect] インフルエンサー検索結果:', purchasedSlot);
        } else if (!isInfluencer && supabaseUser?.id) {
          purchasedSlot = allPurchasedSlots.find(ps => ps.fan_user_id === supabaseUser.id);
          console.log('🔍 [handleTalkSelect] ファン検索結果:', purchasedSlot);
        } else {
          // ユーザー情報がない場合は最初のものを使用
          purchasedSlot = allPurchasedSlots[0];
          console.log('🔍 [handleTalkSelect] ユーザー情報なし、最初のものを使用:', purchasedSlot);
        }
      } else {
        console.warn('⚠️ [handleTalkSelect] purchased_slotsが0件:', {
          'talkId': talk.id,
          'userId': supabaseUser?.id,
          'isInfluencer': isInfluencer,
        });
      }

      if (purchasedSlot && purchasedSlot.id) {
        // purchased_slotが見つかった場合
        console.log('✅ [handleTalkSelect] purchased_slotを取得:', purchasedSlot.id);
        navigate(`/call/${purchasedSlot.id}`);
        return;
      }

      // purchased_slotが見つからない場合
      // これは通常発生しないはず（オークション完了後はpurchased_slotsが作成される）
      console.warn('⚠️ [handleTalkSelect] purchased_slotが見つかりません:', {
        talkId: talk.id,
        userId: supabaseUser?.id,
        isInfluencer,
        talkStatus: talk.status,
        auctionStatus: talk.auction_status,
      });
      
      // オークション完了画面に遷移
      navigate(`/talk/${talk.id}`);
    } catch (err) {
      console.error('❌ [handleTalkSelect] 予期しないエラー:', err);
      // エラーが発生した場合もオークション完了画面に遷移
      navigate(`/talk/${talk.id}`);
    }
  };

  const tabs = [
    {
      id: 'upcoming',
      label: isInfluencer ? 'ホストするTalk' : '落札したTalk',
      icon: isInfluencer ? Users : Trophy
    },
    { id: 'history', label: isInfluencer ? '過去の実績' : '過去の実績', icon: History },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          {isInfluencer ? 'ホストするTalk' : 'マイTalk'}
        </h1>
        <p className="text-gray-600">
          {isInfluencer
            ? '未完了のTalk枠と過去の実績を確認できます'
            : '落札したTalkと過去の実績を確認できます'}
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-lg">
        <div className="border-b border-gray-200">
          <div className="flex justify-center space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-4 border-b-2 transition-colors ${activeTab === tab.id
                  ? 'border-pink-500 text-pink-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
                  }`}
              >
                <tab.icon className="h-5 w-5" />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg mb-6">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {activeTab === 'upcoming' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-800">
                {isInfluencer ? '未完了のTalk' : '予定されているTalk'}
              </h2>

              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse bg-gray-100 h-48 rounded-lg"></div>
                  ))}
                </div>
              ) : upcomingTalks.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {upcomingTalks.map((talk) => (
                    <TalkCard
                      key={talk.id}
                      talk={talk}
                      onSelect={handleTalkSelect}
                      showFanProfile={isInfluencer}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  {isInfluencer ? (
                    <Users className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                  ) : (
                    <Trophy className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                  )}
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {isInfluencer ? '未完了のTalk枠がありません' : '落札したTalk枠がありません'}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {isInfluencer
                      ? 'Talk枠を作成して販売しましょう！'
                      : '気になるTalk枠を見つけて入札してみましょう！'}
                  </p>
                  <button
                    onClick={() => navigate(isInfluencer ? '/mypage' : '/')}
                    className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:from-pink-600 hover:to-purple-700 transition-all duration-200"
                  >
                    {isInfluencer ? 'Talk枠を作成' : 'Talk枠を探す'}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-800">過去のTalk実績</h2>

              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse bg-gray-100 h-48 rounded-lg"></div>
                  ))}
                </div>
              ) : pastTalks.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pastTalks.map((talk) => (
                    <div key={talk.id} className="relative">
                      <TalkCard
                        talk={talk}
                        onSelect={handleTalkSelect}
                        showFanProfile={isInfluencer}
                      />
                      {/* Completed Badge */}
                      <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                        完了
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <History className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">過去のTalk実績がありません</h3>
                  <p className="text-gray-500">Talk枠を落札して実績を作りましょう！</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}