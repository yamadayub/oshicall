import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import CallWaitingRoom from '../components/calls/CallWaitingRoom';
import VideoCall from '../components/calls/VideoCall';
import CallReviewPrompt from '../components/calls/CallReviewPrompt';
import CallCompletedScreen from '../components/calls/CallCompletedScreen';

type CallPageState = 
  | 'loading'
  | 'waiting'
  | 'ready'
  | 'joining'
  | 'in-call'
  | 'ended'
  | 'error';

export default function CallPage() {
  const { purchasedSlotId } = useParams<{ purchasedSlotId: string }>();
  const { user, supabaseUser } = useAuth();
  const navigate = useNavigate();

  const [state, setState] = useState<CallPageState>('loading');
  const [purchasedSlot, setPurchasedSlot] = useState<any>(null);
  const [userType, setUserType] = useState<'influencer' | 'fan'>('fan');
  const [roomData, setRoomData] = useState<{ roomUrl: string; token: string } | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const [influencer, setInfluencer] = useState<any>(null);

  useEffect(() => {
    const loadCallData = async () => {
      if (!user || !supabaseUser) {
        setError('ログインが必要です');
        setState('error');
        return;
      }

      try {
        setState('loading');
        console.log('🔵 CallPage: データ取得開始', { purchasedSlotId, userId: supabaseUser.id });

        // purchased_slotsデータを取得
        const { data, error: fetchError } = await supabase
          .from('purchased_slots')
          .select(`
            *,
            call_slots (
              id,
              title,
              description,
              scheduled_start_time,
              duration_minutes,
              user_id
            )
          `)
          .eq('id', purchasedSlotId)
          .single();

        if (fetchError || !data) {
          console.error('❌ CallPage: データ取得エラー', fetchError);
          setError('通話情報が見つかりません');
          setState('error');
          return;
        }

        console.log('✅ CallPage: データ取得成功', {
          purchasedSlotId,
          influencer_user_id: data.influencer_user_id,
          fan_user_id: data.fan_user_id,
          current_user_id: supabaseUser.id,
          call_status: data.call_status,
        });

        // ユーザー権限確認
        const callSlot = Array.isArray(data.call_slots) ? data.call_slots[0] : data.call_slots;
        const isInfluencer = data.influencer_user_id === supabaseUser.id;
        const isFan = data.fan_user_id === supabaseUser.id;

        console.log('🔵 CallPage: 権限チェック', { isInfluencer, isFan });

        if (!isInfluencer && !isFan) {
          console.error('❌ CallPage: アクセス権限なし');
          setError('この通話にアクセスする権限がありません');
          setState('error');
          return;
        }

        setUserType(isInfluencer ? 'influencer' : 'fan');
        setPurchasedSlot({ ...data, call_slots: callSlot });

        // call_statusに応じて初期状態を設定
        if (data.call_status === 'completed') {
          setState('ended');
        } else {
          // 既にDaily.coに接続済みの場合は、roomDataを取得してVideoCallを表示
          const isAlreadyJoined = (isInfluencer && data.influencer_joined_at) || (isFan && data.fan_joined_at);
          
          if (isAlreadyJoined) {
            console.log('🔵 既に接続済み - roomDataを取得してVideoCallを表示');
            try {
              // roomDataを取得
              const { createCallRoom } = await import('../api/calls');
              const roomDataResult = await createCallRoom(purchasedSlotId!, supabaseUser.id);
              setRoomData({
                roomUrl: roomDataResult.roomUrl,
                token: roomDataResult.token,
              });
              setState('in-call');
            } catch (err: any) {
              console.error('❌ roomData取得エラー:', err);
              // エラーでも待機室に戻る
              setState('ready');
            }
          } else {
            // 待機室にはいつでも入室可能
            setState('ready');
          }
        }

      } catch (err: any) {
        console.error('データ取得エラー:', err);
        setError(err.message || 'データの取得に失敗しました');
        setState('error');
      }
    };

    loadCallData();
  }, [purchasedSlotId, user, supabaseUser]);

  // インフルエンサー情報の取得（通話終了時用）
  useEffect(() => {
    if (state === 'ended' && purchasedSlot) {
      const fetchInfluencer = async () => {
        const { data } = await supabase
          .from('users')
          .select('display_name, profile_image_url')
          .eq('id', purchasedSlot.influencer_user_id)
          .single();

        setInfluencer(data);
      };

      fetchInfluencer();
    }
  }, [state, purchasedSlot]);

  const handleJoinCall = async (roomUrl: string, token: string) => {
    setState('joining');
    try {
      // 参加処理はVideoCallコンポーネント内で実行
      setRoomData({ roomUrl, token });
      setState('in-call');
    } catch (err: any) {
      setError('入室に失敗しました');
      setState('error');
    }
  };

  const handleCallEnd = (callDuration: number) => {
    setDuration(callDuration);
    setState('ended');
  };

  const handleReviewSubmit = async (rating: number, comment: string) => {
    try {
      // レビューをSupabaseに保存
      await supabase.from('reviews').insert({
        purchased_slot_id: purchasedSlotId,
        fan_user_id: purchasedSlot.fan_user_id,
        influencer_user_id: purchasedSlot.influencer_user_id,
        rating,
        comment,
        is_public: true,
      });

      console.log('✅ レビュー投稿成功');
      navigate('/mypage');
    } catch (err) {
      console.error('レビュー投稿エラー:', err);
      alert('レビューの投稿に失敗しました');
    }
  };

  const handleSkipReview = () => {
    navigate('/mypage');
  };

  // ローディング状態
  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  // エラー状態
  if (state === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">😞</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">エラー</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/mypage')}
            className="px-6 py-3 bg-pink-500 text-white rounded-lg hover:bg-pink-600"
          >
            マイページに戻る
          </button>
        </div>
      </div>
    );
  }

  // 待機・入室可能状態
  if (state === 'waiting' || state === 'ready') {
    return (
      <CallWaitingRoom
        purchasedSlotId={purchasedSlotId!}
        userId={supabaseUser!.id}
        userType={userType}
        scheduledStartTime={purchasedSlot.call_slots.scheduled_start_time}
        durationMinutes={purchasedSlot.call_slots.duration_minutes}
        title={purchasedSlot.call_slots.title}
        onJoinCall={handleJoinCall}
      />
    );
  }

  // 入室処理中
  if (state === 'joining') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600">通話ルームに接続中...</p>
        </div>
      </div>
    );
  }

  // 通話中
  if (state === 'in-call' && roomData) {
    return (
      <VideoCall
        roomUrl={roomData.roomUrl}
        token={roomData.token}
        purchasedSlotId={purchasedSlotId!}
        durationMinutes={purchasedSlot.call_slots.duration_minutes}
        scheduledStartTime={purchasedSlot.call_slots.scheduled_start_time}
        userId={supabaseUser!.id}
        userType={userType}
        onCallEnd={handleCallEnd}
      />
    );
  }

  // 通話終了・レビュー
  if (state === 'ended') {
    // インフルエンサーの場合は完了画面のみ
    if (userType === 'influencer') {
      return (
        <CallCompletedScreen
          userType="influencer"
          duration={duration}
          title={purchasedSlot?.call_slots?.title || '通話'}
          onNavigate={() => navigate('/influencer-dashboard')}
        />
      );
    }

    // ファンの場合：まず完了画面、その後レビュー画面
    // influencer情報がまだロードされていない場合は待機
    if (!influencer) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
            <p className="text-gray-600">読み込み中...</p>
          </div>
        </div>
      );
    }

    // ファンはレビュー画面へ
    return (
      <CallReviewPrompt
        influencerName={influencer.display_name}
        influencerImage={influencer.profile_image_url || '/images/talks/default.jpg'}
        actualDuration={duration}
        onReviewSubmit={handleReviewSubmit}
        onSkip={handleSkipReview}
      />
    );
  }

  const formatDuration = (minutes: number) => {
    const mins = Math.floor(minutes);
    const secs = Math.floor((minutes - mins) * 60);
    return `${mins}分${secs}秒`;
  };

  return null;
}

