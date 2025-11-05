import React, { useState, useEffect } from 'react';
import { Trophy, Crown, TrendingUp, Users, Sparkles, Star, Gem } from 'lucide-react';
import { getInfluencerRankings, getBidderRankings, getRankingStats } from '../api/rankings';
import type { InfluencerRanking, BidderRanking, RankingStats } from '../api/rankings';

export default function Rankings() {
  const [activeTab, setActiveTab] = useState<'influencers' | 'bidders'>('influencers');
  const [influencerRankings, setInfluencerRankings] = useState<InfluencerRanking[]>([]);
  const [bidderRankings, setBidderRankings] = useState<BidderRanking[]>([]);
  const [stats, setStats] = useState<RankingStats | null>(null);
  const [loading, setLoading] = useState(true);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ja-JP').format(price);
  };

  // データ取得
  useEffect(() => {
    const fetchRankings = async () => {
      try {
        setLoading(true);
        const [influencers, bidders, statistics] = await Promise.all([
          getInfluencerRankings(10),
          getBidderRankings(10),
          getRankingStats(),
        ]);
        setInfluencerRankings(influencers);
        setBidderRankings(bidders);
        setStats(statistics);
      } catch (error) {
        console.error('Error fetching rankings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRankings();
  }, []);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-8 w-8 text-yellow-400 animate-pulse" />;
      case 2:
        return <Gem className="h-8 w-8 text-gray-300" />;
      case 3:
        return <Trophy className="h-8 w-8 text-amber-500" />;
      default:
        return <div className="h-8 w-8 flex items-center justify-center bg-gradient-to-r from-pink-400 to-purple-500 text-white rounded-full text-sm font-bold shadow-lg">{rank}</div>;
    }
  };

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 shadow-lg shadow-yellow-500/50 animate-pulse';
      case 2:
        return 'bg-gradient-to-r from-gray-300 via-gray-400 to-gray-500 shadow-lg shadow-gray-400/50';
      case 3:
        return 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 shadow-lg shadow-amber-500/50';
      default:
        return 'bg-gradient-to-r from-pink-400 to-purple-500 shadow-lg shadow-pink-500/30';
    }
  };

  const getRankGlow = (rank: number) => {
    switch (rank) {
      case 1:
        return 'shadow-2xl shadow-yellow-500/30 ring-4 ring-yellow-400/50';
      case 2:
        return 'shadow-xl shadow-gray-400/30 ring-2 ring-gray-300/50';
      case 3:
        return 'shadow-xl shadow-amber-500/30 ring-2 ring-amber-400/50';
      default:
        return 'shadow-lg shadow-pink-500/20';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-8 px-4 md:px-6 pt-6 md:pt-8">
      {/* Header */}
      <div className="text-center relative">
        <div className="absolute inset-0 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 opacity-10 rounded-3xl blur-3xl"></div>
        <div className="relative">
          <div className="flex justify-center mb-4 md:mb-6">
            <div className="relative">
              <div className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 p-4 md:p-6 rounded-full shadow-2xl shadow-yellow-500/50 animate-pulse">
                <Trophy className="h-12 w-12 md:h-16 md:w-16 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 md:-top-2 md:-right-2">
                <Sparkles className="h-4 w-4 md:h-6 md:w-6 text-yellow-400 animate-spin" />
              </div>
              <div className="absolute -bottom-1 -left-1 md:-bottom-2 md:-left-2">
                <Star className="h-3 w-3 md:h-5 md:w-5 text-pink-400 animate-bounce" />
              </div>
            </div>
          </div>
          <h1 className="text-4xl md:text-6xl font-black bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 bg-clip-text text-transparent mb-2 md:mb-4 drop-shadow-lg">
            ランキング
          </h1>
          <p className="text-base md:text-xl text-gray-700 font-medium">✨ 推しトークのトップパフォーマーをチェック ✨</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gradient-to-r from-white via-pink-50 to-purple-50 rounded-2xl md:rounded-3xl shadow-2xl border-2 border-pink-200">
        <div className="border-b-2 border-gradient-to-r from-pink-200 to-purple-200">
          <div className="flex flex-col md:flex-row justify-center space-y-2 md:space-y-0 md:space-x-8 px-4 md:px-6">
            <button
              onClick={() => setActiveTab('influencers')}
              className={`flex items-center justify-center space-x-2 md:space-x-3 py-4 md:py-6 border-b-4 transition-all duration-300 transform hover:scale-105 ${
                activeTab === 'influencers'
                  ? 'border-pink-500 text-pink-600 bg-gradient-to-r from-pink-50 to-purple-50'
                  : 'border-transparent text-gray-600 hover:text-pink-600 hover:border-pink-300'
              }`}
            >
              <TrendingUp className="h-5 w-5 md:h-6 md:w-6" />
              <span className="font-bold text-sm md:text-lg">✨ インフルエンサーランキング ✨</span>
            </button>
            <button
              onClick={() => setActiveTab('bidders')}
              className={`flex items-center justify-center space-x-2 md:space-x-3 py-4 md:py-6 border-b-4 transition-all duration-300 transform hover:scale-105 ${
                activeTab === 'bidders'
                  ? 'border-purple-500 text-purple-600 bg-gradient-to-r from-purple-50 to-pink-50'
                  : 'border-transparent text-gray-600 hover:text-purple-600 hover:border-purple-300'
              }`}
            >
              <Users className="h-5 w-5 md:h-6 md:w-6" />
              <span className="font-bold text-sm md:text-lg">💎 ビッダーランキング 💎</span>
            </button>
          </div>
        </div>

        <div className="p-4 md:p-8">
          {activeTab === 'influencers' ? (
            <div className="space-y-4 md:space-y-6">
              <div className="text-center mb-6 md:mb-8">
                <h2 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent mb-2">
                  💰 総獲得金額ランキング 💰
                </h2>
                <p className="text-gray-600 text-sm md:text-base">トップパフォーマーたち</p>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto"></div>
                  <p className="mt-4 text-gray-600">ランキング読み込み中...</p>
                </div>
              ) : influencerRankings.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600">まだランキングデータがありません</p>
                </div>
              ) : influencerRankings.map((influencer, index) => (
                <div
                  key={influencer.id}
                  className={`p-4 md:p-8 rounded-xl md:rounded-2xl border-4 transition-all duration-500 hover:scale-105 transform ${getRankGlow(index + 1)} ${
                    index < 3 
                      ? index === 0 
                        ? 'border-yellow-300 bg-gradient-to-r from-yellow-50 via-amber-50 to-yellow-100' 
                        : index === 1
                        ? 'border-gray-300 bg-gradient-to-r from-gray-50 via-slate-50 to-gray-100'
                        : 'border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100'
                      : 'border-pink-200 bg-gradient-to-r from-white via-pink-50 to-purple-50'
                  }`}
                >
                  <div className="flex flex-col md:flex-row items-center md:items-start space-y-4 md:space-y-0 md:space-x-8">
                    <div className="flex flex-col md:flex-row items-center md:items-center space-y-4 md:space-y-0 md:space-x-6">
                      <div className={`p-3 md:p-4 rounded-full text-white ${getRankBadge(index + 1)}`}>
                        {getRankIcon(index + 1)}
                      </div>
                      <div className="relative">
                        <img
                          src={influencer.profile_image_url || 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=100'}
                          alt={influencer.display_name}
                          className={`h-20 w-20 md:h-24 md:w-24 rounded-full object-cover border-4 shadow-xl ${
                            index < 3 ? 'border-yellow-300' : 'border-pink-300'
                          }`}
                        />
                        {index < 3 && (
                          <div className="absolute -top-1 -right-1 md:-top-2 md:-right-2">
                            <Sparkles className="h-4 w-4 md:h-6 md:w-6 text-yellow-400 animate-pulse" />
                          </div>
                        )}
                      </div>
                      <div className="text-center md:text-left">
                        <h3 className="text-xl md:text-2xl font-black text-gray-800 mb-1">{influencer.display_name}</h3>
                      </div>
                    </div>
                    
                    <div className="text-center md:text-right space-y-2 md:space-y-3">
                      <div className="text-3xl md:text-4xl font-black bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-transparent">
                        ¥{formatPrice(influencer.total_earned)}
                      </div>
                      <div className="text-base md:text-lg text-gray-600 font-bold">
                        🎤 {influencer.total_talks}回のTalk実施
                      </div>
                      {index < 3 && (
                        <div className="text-xs md:text-sm font-bold text-yellow-600 animate-pulse">
                          🏆 TOP {index + 1} 達成！
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4 md:space-y-6">
              <div className="text-center mb-6 md:mb-8">
                <h2 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-purple-500 to-pink-600 bg-clip-text text-transparent mb-2">
                  💸 総支払い額ランキング 💸
                </h2>
                <p className="text-gray-600 text-sm md:text-base">最も熱いビッダーたち</p>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
                  <p className="mt-4 text-gray-600">ランキング読み込み中...</p>
                </div>
              ) : bidderRankings.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600">まだランキングデータがありません</p>
                </div>
              ) : bidderRankings.map((bidder, index) => (
                <div
                  key={bidder.id}
                  className={`p-4 md:p-8 rounded-xl md:rounded-2xl border-4 transition-all duration-500 hover:scale-105 transform ${getRankGlow(index + 1)} ${
                    index < 3
                      ? index === 0
                        ? 'border-yellow-300 bg-gradient-to-r from-yellow-50 via-amber-50 to-yellow-100'
                        : index === 1
                        ? 'border-gray-300 bg-gradient-to-r from-gray-50 via-slate-50 to-gray-100'
                        : 'border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100'
                      : 'border-purple-200 bg-gradient-to-r from-white via-purple-50 to-pink-50'
                  }`}
                >
                  <div className="flex flex-col md:flex-row items-center md:items-start space-y-4 md:space-y-0 md:space-x-8">
                    <div className="flex flex-col md:flex-row items-center md:items-center space-y-4 md:space-y-0 md:space-x-6">
                      <div className={`p-3 md:p-4 rounded-full text-white ${getRankBadge(index + 1)}`}>
                        {getRankIcon(index + 1)}
                      </div>
                      <div className="relative">
                        <img
                          src={bidder.profile_image_url || 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=100'}
                          alt={bidder.display_name}
                          className={`h-20 w-20 md:h-24 md:w-24 rounded-full object-cover border-4 shadow-xl ${
                            index < 3 ? 'border-yellow-300' : 'border-purple-300'
                          }`}
                        />
                        {index < 3 && (
                          <div className="absolute -top-1 -right-1 md:-top-2 md:-right-2">
                            <Sparkles className="h-4 w-4 md:h-6 md:w-6 text-purple-400 animate-pulse" />
                          </div>
                        )}
                      </div>
                      <div className="text-center md:text-left">
                        <h3 className="text-xl md:text-2xl font-black text-gray-800 mb-1">{bidder.display_name}</h3>
                        <p className="text-gray-600 font-medium text-sm md:text-base">💎 VIPビッダー</p>
                        <div className="flex flex-col md:flex-row items-center md:items-center space-y-2 md:space-y-0 md:space-x-6 mt-2 text-xs md:text-sm">
                          <span className="bg-purple-100 text-purple-700 px-2 py-1 md:px-3 md:py-1 rounded-full font-bold">
                            🎯 {bidder.successful_bids}回落札成功
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-center md:text-right space-y-2 md:space-y-3">
                      <div className="text-3xl md:text-4xl font-black bg-gradient-to-r from-purple-500 to-pink-600 bg-clip-text text-transparent">
                        ¥{formatPrice(bidder.total_spent)}
                      </div>
                      <div className="text-base md:text-lg text-gray-600 font-bold">
                        💰 総支払い額
                      </div>
                      {index < 3 && (
                        <div className="text-xs md:text-sm font-bold text-purple-600 animate-pulse">
                          🏆 TOP {index + 1} 達成！
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fun Facts */}
      <div className="bg-gradient-to-r from-pink-100 via-purple-100 to-indigo-100 rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-2xl border-2 border-pink-200">
        <h3 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent mb-4 md:mb-6 text-center">
          📊 推しトーク統計 📊
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 text-center max-w-4xl mx-auto">
          <div className="space-y-2 md:space-y-3 bg-white rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
            <div className="text-3xl md:text-5xl font-black bg-gradient-to-r from-pink-500 to-rose-600 bg-clip-text text-transparent">
              {stats ? `¥${formatPrice(stats.total_transaction_amount)}` : '¥0'}
            </div>
            <div className="text-base md:text-lg text-gray-700 font-bold">💰 総取引額</div>
            <div className="text-xs md:text-sm text-gray-500">累計</div>
          </div>
          <div className="space-y-2 md:space-y-3 bg-white rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
            <div className="text-3xl md:text-5xl font-black bg-gradient-to-r from-purple-500 to-indigo-600 bg-clip-text text-transparent">
              {stats ? stats.total_talks_completed : 0}
            </div>
            <div className="text-base md:text-lg text-gray-700 font-bold">🎤 成立したTalk数</div>
            <div className="text-xs md:text-sm text-gray-500">累計実績</div>
          </div>
        </div>
      </div>
    </div>
  );
}