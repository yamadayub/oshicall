import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, History, Calendar, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getUpcomingPurchasedTalks, getCompletedPurchasedTalks, getUpcomingHostedTalks, getCompletedHostedTalks } from '../api/purchasedTalks';
import TalkCard from '../components/TalkCard';
import { TalkSession } from '../types';

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

  const handleTalkSelect = (talk: TalkSession) => {
    // Navigate to the call page if purchased_slot_id exists
    if (talk.purchased_slot_id) {
      navigate(`/call/${talk.purchased_slot_id}`);
    } else {
      // Fallback to live-talk if no purchased_slot_id (shouldn't happen for purchased talks)
      navigate(`/live-talk/${talk.id}`);
    }
  };

  const tabs = [
    {
      id: 'upcoming',
      label: isInfluencer ? 'ホストするTalk' : '落札したTalk',
      icon: isInfluencer ? Users : Trophy
    },
    { id: 'history', label: '過去の実績', icon: History },
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
            ? '販売済みのTalk枠と過去の実績を確認できます'
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
                className={`flex items-center space-x-2 py-4 border-b-2 transition-colors ${
                  activeTab === tab.id
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
                {isInfluencer ? '予定されているTalk' : '予定されているTalk'}
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
                    {isInfluencer ? '販売済みのTalk枠がありません' : '落札したTalk枠がありません'}
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