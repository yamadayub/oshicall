import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Video, Heart, ThumbsUp, Star, Gift, Smile, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { TalkSession } from '../types';
import CountdownTimer from '../components/CountdownTimer';

export default function LiveTalk() {
  const { talkId } = useParams<{ talkId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTalk, setActiveTalk] = useState<TalkSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reactions, setReactions] = useState<{ [key: string]: number }>({
    heart: 0,
    thumbsUp: 0,
    star: 0,
    gift: 0,
    smile: 0,
  });

  useEffect(() => {
    const fetchTalkData = async () => {
      if (!talkId) return;

      try {
        setIsLoading(true);
        console.log('🔍 [LiveTalk] Talkデータ取得開始:', talkId);

        // call_slotsとusers（インフルエンサー）の情報を取得
        const { data: callSlot, error } = await supabase
          .from('call_slots')
          .select(`
            *,
            influencer:user_id (
              id,
              display_name,
              profile_image_url,
              bio
            )
          `)
          .eq('id', talkId)
          .single();

        if (error) {
          throw error;
        }

        if (!callSlot) {
          console.error('❌ [LiveTalk] Talkが見つかりません');
          return;
        }

        // TalkSession形式に変換
        const talkSession: TalkSession = {
          id: callSlot.id,
          influencer_id: callSlot.user_id,
          influencer: {
            id: callSlot.influencer.id,
            name: callSlot.influencer.display_name,
            username: callSlot.influencer.display_name,
            avatar_url: callSlot.influencer.profile_image_url,
            description: callSlot.influencer.bio || '',
            follower_count: 0,
            total_earned: 0,
            total_talks: 0,
            rating: 0,
            created_at: new Date().toISOString(),
          },
          title: callSlot.title,
          description: callSlot.description || '',
          host_message: callSlot.description || 'Welcome to the Live Talk!',
          start_time: callSlot.scheduled_start_time,
          end_time: callSlot.end_time ||
            new Date(new Date(callSlot.scheduled_start_time).getTime() + (callSlot.duration_minutes || 30) * 60000).toISOString(),
          auction_end_time: callSlot.scheduled_start_time, // 仮
          starting_price: callSlot.starting_price,
          current_highest_bid: 0,
          status: 'active',
          created_at: callSlot.created_at,
          detail_image_url: callSlot.thumbnail_url || callSlot.influencer.profile_image_url,
          is_female_only: false, // 暫定
        };

        setActiveTalk(talkSession);
      } catch (err) {
        console.error('❌ [LiveTalk] データ取得エラー:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTalkData();
  }, [talkId]);

  const reactionButtons = [
    { id: 'heart', icon: Heart, color: 'text-pink-500', bgColor: 'bg-pink-100 hover:bg-pink-200' },
    { id: 'thumbsUp', icon: ThumbsUp, color: 'text-blue-500', bgColor: 'bg-blue-100 hover:bg-blue-200' },
    { id: 'star', icon: Star, color: 'text-yellow-500', bgColor: 'bg-yellow-100 hover:bg-yellow-200' },
    { id: 'gift', icon: Gift, color: 'text-purple-500', bgColor: 'bg-purple-100 hover:bg-purple-200' },
    { id: 'smile', icon: Smile, color: 'text-green-500', bgColor: 'bg-green-100 hover:bg-green-200' },
  ];

  const handleReaction = (reactionId: string) => {
    setReactions(prev => ({
      ...prev,
      [reactionId]: prev[reactionId] + 1
    }));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-pink-500 animate-spin" />
      </div>
    );
  }

  if (!activeTalk) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
        <p className="mb-4">Talkが見つかりません</p>
        <button
          onClick={() => navigate('/talk')}
          className="px-4 py-2 bg-pink-500 rounded-full hover:bg-pink-600 transition-colors"
        >
          戻る
        </button>
      </div>
    );
  }

  return (
    <div className="bg-black min-h-screen -mx-4 sm:-mx-6 lg:-mx-8 -mt-12 pb-12 md:pb-0">
      {/* Main Video Area */}
      <div className="relative min-h-[calc(100vh-48px-48px)]">
        {/* Background Video/Image */}
        <div
          className="absolute inset-0 bg-cover"
          style={{
            backgroundImage: `url(${activeTalk.detail_image_url})`,
            backgroundPosition: 'center top',
            backgroundAttachment: 'scroll'
          }}
        />

        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-black/30" />

        {/* Top Bar */}
        <div className="absolute top-12 left-0 right-0 z-20 bg-gradient-to-b from-black/60 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate(`/talk`)}
                className="text-white p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <div className="flex items-center space-x-3">
                <img
                  src={activeTalk.influencer.avatar_url}
                  alt={activeTalk.influencer.name}
                  className="h-10 w-10 rounded-full object-cover border-2 border-white"
                />
                <div>
                  <h2 className="text-white font-bold text-lg">
                    {activeTalk.influencer.name}
                  </h2>
                  {activeTalk.is_female_only && (
                    <span className="bg-pink-500/80 text-white px-2 py-0.5 rounded-full text-xs font-medium">
                      女性限定
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Live Indicator */}
            <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center space-x-1">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span>LIVE</span>
            </div>
          </div>
        </div>

        {/* Right Side - Reactions */}
        <div className="absolute right-4 bottom-24 z-20 flex flex-col space-y-3">
          {reactionButtons.map((reaction) => (
            <button
              key={reaction.id}
              onClick={() => handleReaction(reaction.id)}
              className={`relative ${reaction.bgColor} p-3 rounded-full shadow-lg transition-all duration-200 hover:scale-110`}
            >
              <reaction.icon className={`h-5 w-5 ${reaction.color}`} />
              {reactions[reaction.id] > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                  {reactions[reaction.id]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Bottom Bar - Time Remaining */}
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent p-4 pb-6 md:pb-4">
          {/* Host Message */}
          <div className="text-left mb-4">
            <p className="text-white/90 text-sm drop-shadow-md">
              {activeTalk.host_message}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-white">
              <p className="text-sm opacity-80 mb-1">Talk終了まで</p>
              <CountdownTimer
                targetTime={activeTalk.end_time}
                className="text-white"
              />
            </div>

            <div className="text-white text-right">
              <p className="text-sm opacity-80 mb-1">開始時間</p>
              <p className="font-medium">
                {formatDate(activeTalk.start_time)} - {formatDate(activeTalk.end_time)}
              </p>
            </div>
          </div>
        </div>

        {/* Floating Reactions Animation Area */}
        <div className="absolute inset-0 pointer-events-none z-15">
          {/* This would be where animated reactions float up */}
        </div>
      </div>
    </div>
  );
}