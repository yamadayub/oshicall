import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, Heart, Star, DollarSign, Phone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TalkSession } from '../types';
import TalkCard from '../components/TalkCard';
import { useAuth } from '../contexts/AuthContext';
import { followInfluencer, unfollowInfluencer, checkFollowStatus } from '../api/follows';

export default function InfluencerPage() {
  const { influencerId } = useParams<{ influencerId: string }>();
  const navigate = useNavigate();
  const { supabaseUser } = useAuth();
  const [influencer, setInfluencer] = useState<any>(null);
  const [talks, setTalks] = useState<TalkSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowingInfluencer, setIsFollowingInfluencer] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'ended'>('active');

  useEffect(() => {
    const fetchInfluencerData = async () => {
      if (!influencerId) {
        navigate('/');
        return;
      }

      try {
        setIsLoading(true);

        // Fetch influencer profile
        const { data: influencerData, error: influencerError } = await supabase
          .from('users')
          .select('*')
          .eq('id', influencerId)
          .eq('is_influencer', true)
          .single();

        if (influencerError || !influencerData) {
          console.error('インフルエンサー取得エラー:', influencerError);
          navigate('/');
          return;
        }

        setInfluencer(influencerData);

        // Check if current user is following this influencer
        if (supabaseUser) {
          const following = await checkFollowStatus(supabaseUser.id, influencerId);
          setIsFollowingInfluencer(following);
        }

        // Fetch this influencer's auctions (both active and ended)
        const { data: auctionData, error: auctionError } = await supabase
          .from('auctions')
          .select(`
            id,
            call_slot_id,
            status,
            start_time,
            end_time,
            current_highest_bid,
            current_winner_id,
            call_slots!inner(
              id,
              user_id,
              title,
              description,
              scheduled_start_time,
              duration_minutes,
              starting_price,
              minimum_bid_increment,
              buy_now_price,
              thumbnail_url,
              users!call_slots_user_id_fkey(
                id,
                display_name,
                bio,
                profile_image_url,
                total_calls_completed,
                average_rating
              )
            )
          `)
          .eq('call_slots.user_id', influencerId)
          .in('status', ['active', 'ended'])
          .order('end_time', { ascending: false });

        if (auctionError) {
          console.error('オークションデータ取得エラー:', auctionError);
        }

        console.log(`📊 ${influencerData.display_name}のTalk枠:`, auctionData?.length || 0, '件');

        // Convert to TalkSession format
        const talkSessions: TalkSession[] = (auctionData || []).map((item: any) => {
          const callSlot = item.call_slots;
          const user = callSlot?.users;

          return {
            id: item.call_slot_id,
            influencer_id: callSlot?.user_id,
            influencer: {
              id: callSlot?.user_id,
              name: user?.display_name || '不明',
              username: user?.display_name || '不明',
              avatar_url: user?.profile_image_url || '/images/talks/default.jpg',
              description: user?.bio || '',
              follower_count: 0,
              total_earned: 0,
              total_talks: user?.total_calls_completed || 0,
              rating: user?.average_rating || 0,
              created_at: new Date().toISOString(),
            },
            title: callSlot?.title || `${user?.display_name}とのTalk`,
            description: callSlot?.description || '',
            host_message: user?.bio || callSlot?.description || '',
            start_time: callSlot?.scheduled_start_time,
            end_time: new Date(new Date(callSlot?.scheduled_start_time).getTime() + (callSlot?.duration_minutes || 30) * 60000).toISOString(),
            auction_end_time: item.end_time,
            starting_price: callSlot?.starting_price,
            current_highest_bid: item.current_highest_bid || callSlot?.starting_price,
            buy_now_price: callSlot?.buy_now_price || null,
            status: item.status === 'active' ? 'upcoming' : 'ended',
            auction_status: item.status,
            created_at: new Date().toISOString(),
            detail_image_url: callSlot?.thumbnail_url || user?.profile_image_url || '/images/talks/default.jpg',
            is_female_only: false,
          };
        });

        setTalks(talkSessions);
      } catch (err) {
        console.error('❌ データ取得エラー:', err);
        navigate('/');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInfluencerData();
  }, [influencerId, navigate, supabaseUser]);

  const handleFollow = async () => {
    if (!supabaseUser) {
      alert('ログインが必要です');
      return;
    }

    if (!influencerId) return;

    try {
      setIsFollowLoading(true);
      if (isFollowingInfluencer) {
        await unfollowInfluencer(supabaseUser.id, influencerId);
        setIsFollowingInfluencer(false);
      } else {
        await followInfluencer(supabaseUser.id, influencerId);
        setIsFollowingInfluencer(true);
      }
    } catch (err) {
      console.error('フォロー操作エラー:', err);
      alert('フォロー操作に失敗しました');
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleTalkSelect = (talk: TalkSession) => {
    navigate(`/talk/${talk.id}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!influencer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😞</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">インフルエンサーが見つかりません</h2>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-pink-500 text-white rounded-lg hover:bg-pink-600"
          >
            ホームに戻る
          </button>
        </div>
      </div>
    );
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ja-JP').format(price);
  };

  return (
    <div className="space-y-6">
      {/* Influencer Header */}
      <div className="bg-gradient-to-r from-pink-50 via-purple-50 to-indigo-100 rounded-xl p-6 border-2 border-pink-200 shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-6">
          <img
            src={influencer.profile_image_url || '/images/default-avatar.png'}
            alt={influencer.display_name}
            className="h-24 w-24 md:h-32 md:w-32 rounded-full border-4 border-white shadow-lg object-cover flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 truncate">
                {influencer.display_name}
              </h1>
              <span className="bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-bold flex-shrink-0">
                ✨ インフルエンサー
              </span>
            </div>
            {influencer.bio && (
              <p className="text-gray-700 mb-4">{influencer.bio}</p>
            )}
            <div className="flex flex-wrap gap-4 text-sm text-gray-700">
              <div className="flex items-center space-x-1">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span>総収益: <span className="font-bold text-green-600">¥{formatPrice(influencer.total_earnings || 0)}</span></span>
              </div>
              <div className="flex items-center space-x-1">
                <Phone className="h-4 w-4 text-blue-600" />
                <span>通話数: <span className="font-bold text-blue-600">{influencer.total_calls_completed || 0}</span></span>
              </div>
              <div className="flex items-center space-x-1">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>評価: <span className="font-bold text-purple-600">{influencer.average_rating?.toFixed(1) || '-'}</span></span>
              </div>
            </div>
          </div>
          <div className="flex-shrink-0">
            {supabaseUser && supabaseUser.id !== influencerId && (
              <button
                onClick={handleFollow}
                disabled={isFollowLoading}
                className={`px-6 py-3 rounded-lg font-medium transition-all shadow-md ${
                  isFollowingInfluencer
                    ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    : 'bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:from-pink-600 hover:to-purple-700'
                } disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2`}
              >
                <Heart className={`h-5 w-5 ${isFollowingInfluencer ? 'fill-current' : ''}`} />
                <span>{isFollowingInfluencer ? 'フォロー中' : 'フォローする'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Talks Section with Tabs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center space-x-2">
            <Calendar className="h-6 w-6 text-pink-500" />
            <span>Talk枠一覧</span>
          </h2>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-6 py-3 font-medium transition-all relative ${
              activeTab === 'active'
                ? 'text-pink-600 border-b-2 border-pink-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            オークション中
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-pink-100 text-pink-600">
              {talks.filter(t => (t as any).auction_status === 'active').length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('ended')}
            className={`px-6 py-3 font-medium transition-all relative ${
              activeTab === 'ended'
                ? 'text-gray-900 border-b-2 border-gray-900'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            オークション終了
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
              {talks.filter(t => (t as any).auction_status === 'ended').length}
            </span>
          </button>
        </div>

        {/* Talk Cards */}
        {(() => {
          const filteredTalks = talks.filter(t => (t as any).auction_status === activeTab);

          if (filteredTalks.length === 0) {
            return (
              <div className="text-center py-12 bg-gradient-to-br from-pink-50 to-purple-50 rounded-xl border-2 border-pink-200">
                <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">
                  {activeTab === 'active' ? '現在開催中のTalk枠はありません' : 'オークション終了済みのTalk枠はありません'}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  {activeTab === 'active' ? '新しいTalk枠が追加されるまでお待ちください' : '過去のオークションがここに表示されます'}
                </p>
              </div>
            );
          }

          return (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTalks.map((talk) => (
                <TalkCard key={talk.id} talk={talk} onSelect={handleTalkSelect} />
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
