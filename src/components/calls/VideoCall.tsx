import React, { useEffect, useRef, useState } from 'react';
import DailyIframe from '@daily-co/daily-js';
import { Clock, PhoneOff, Users } from 'lucide-react';
import { endCall, getCallStatus } from '../../api/calls';

interface VideoCallProps {
  roomUrl: string;
  token: string;
  purchasedSlotId: string;
  durationMinutes: number;
  userId: string;
  userType: 'influencer' | 'fan';
  onCallEnd: (duration: number) => void;
}

export default function VideoCall({
  roomUrl,
  token,
  purchasedSlotId,
  durationMinutes,
  userId,
  userType,
  onCallEnd,
}: VideoCallProps) {
  const callFrameRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const initializingRef = useRef(false); // 初期化中フラグ
  const countdownStartedRef = useRef(false); // カウントダウン開始フラグ
  const [isJoined, setIsJoined] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [influencerJoined, setInfluencerJoined] = useState(false);
  const [fanJoined, setFanJoined] = useState(false);
  const [remainingTime, setRemainingTime] = useState(durationMinutes);
  const [isEnding, setIsEnding] = useState(false);
  const [countdownActive, setCountdownActive] = useState(false);
  const [showEndConfirmModal, setShowEndConfirmModal] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // 既存のフレームまたは初期化中の場合は何もしない
    if (callFrameRef.current || initializingRef.current) {
      return;
    }

    initializingRef.current = true;

    const initializeCall = async () => {
      try {
        console.log('🔵 Daily.co通話開始:', { roomUrl, durationMinutes });

        // Daily.coフレーム作成
        const callFrame = DailyIframe.createFrame(containerRef.current!, {
          iframeStyle: {
            width: '100%',
            height: '600px',
            border: 'none',
            borderRadius: '12px',
          },
          showLeaveButton: true,
          showFullscreenButton: true,
          showLocalVideo: true,
          showParticipantsBar: true,
        });

        callFrameRef.current = callFrame;

        // イベントリスナー
        callFrame.on('joined-meeting', (event: any) => {
          console.log('✅ 通話に参加しました:', event);
          setIsJoined(true);
        });

        callFrame.on('participant-joined', (event: any) => {
          console.log('✅ 参加者が入室:', event.participant);
          setParticipantCount(prev => prev + 1);
        });

        callFrame.on('participant-left', (event: any) => {
          console.log('⚠️ 参加者が退出:', event.participant);
          setParticipantCount(prev => Math.max(0, prev - 1));
        });

        callFrame.on('left-meeting', async (event: any) => {
          console.log('⚠️ 通話を退出しました');
          await handleEndCall();
        });

        callFrame.on('error', (event: any) => {
          console.error('❌ 通話エラー:', event);
        });

        // 通話に参加
        await callFrame.join({ url: roomUrl, token: token });

      } catch (error) {
        console.error('❌ 通話初期化エラー:', error);
        initializingRef.current = false;
      }
    };

    initializeCall();

    // クリーンアップ
    return () => {
      if (callFrameRef.current) {
        console.log('🔵 Daily.coフレームをクリーンアップ');
        try {
          callFrameRef.current.destroy();
        } catch (err) {
          console.warn('フレーム破棄エラー:', err);
        }
        callFrameRef.current = null;
      }
      initializingRef.current = false;
    };
  }, []); // 依存配列を空にして初回のみ実行

  // 参加状況をポーリング
  useEffect(() => {
    if (!isJoined) return;

    const pollStatus = async () => {
      try {
        const status = await getCallStatus(purchasedSlotId);
        setInfluencerJoined(status.participants.influencer_joined);
        setFanJoined(status.participants.fan_joined);

        // インフルエンサーが入室したらカウントダウン開始
        if (status.participants.influencer_joined && !countdownStartedRef.current) {
          console.log('✅ インフルエンサーが入室 - カウントダウン開始');
          countdownStartedRef.current = true;
          setCountdownActive(true);
        }
      } catch (error) {
        console.error('❌ 参加状況取得エラー:', error);
      }
    };

    const interval = setInterval(pollStatus, 2000); // 2秒ごとに確認
    pollStatus(); // 初回実行

    return () => clearInterval(interval);
  }, [isJoined, purchasedSlotId]);

  // 残り時間カウントダウン（インフルエンサー入室後のみ）
  useEffect(() => {
    if (!countdownActive) return;

    const timer = setInterval(() => {
      setRemainingTime(prev => {
        const newTime = Math.max(0, prev - 1/60); // 1秒ずつ減少

        // 時間切れで自動終了
        if (newTime <= 0) {
          console.log('⏰ 時間切れ - 自動終了');
          handleEndCall();
        }

        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdownActive]);

  const handleEndCall = async () => {
    if (isEnding) return;
    setIsEnding(true);

    try {
      console.log('🔵 通話終了処理開始');
      
      // Daily.coから退出
      if (callFrameRef.current) {
        await callFrameRef.current.leave();
        callFrameRef.current.destroy();
        callFrameRef.current = null;
      }

      // バックエンドに通話終了を通知
      const result = await endCall(purchasedSlotId, userId);
      console.log('✅ 通話終了:', result);
      
      onCallEnd(result.duration);
    } catch (error) {
      console.error('❌ 通話終了エラー:', error);
      onCallEnd(0);
    }
  };

  const formatTime = (minutes: number) => {
    const mins = Math.floor(minutes);
    const secs = Math.floor((minutes - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* ヘッダー */}
      <div className="max-w-6xl mx-auto mb-4">
        <div className="bg-white rounded-lg shadow-md p-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium text-gray-700">
                {influencerJoined && fanJoined
                  ? '2人参加中'
                  : influencerJoined || fanJoined
                  ? '1人参加中'
                  : '待機中'}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <Clock className={`h-5 w-5 ${countdownActive ? 'text-blue-500' : 'text-gray-400'}`} />
              <span className="text-lg font-bold text-gray-900">
                {countdownActive ? `残り ${formatTime(remainingTime)}` : 'インフルエンサー待ち'}
              </span>
            </div>
          </div>

          <button
            onClick={() => setShowEndConfirmModal(true)}
            disabled={isEnding}
            className="flex items-center space-x-2 px-6 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PhoneOff className="h-5 w-5" />
            <span>{isEnding ? '終了中...' : '通話を終了'}</span>
          </button>
        </div>
      </div>

      {/* ビデオ通話エリア */}
      <div className="max-w-6xl mx-auto">
        <div 
          ref={containerRef} 
          className="bg-black rounded-lg overflow-hidden shadow-2xl"
          style={{ minHeight: '600px' }}
        />
      </div>

      {/* 注意事項 */}
      <div className="max-w-6xl mx-auto mt-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            💡 <strong>ヒント:</strong> カメラやマイクのボタンは画面下部にあります。
            残り時間が0になると自動的に通話が終了します。
          </p>
        </div>
      </div>

      {/* 終了確認モーダル */}
      {showEndConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 md:p-8">
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                <PhoneOff className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                通話を終了しますか？
              </h3>
              <p className="text-gray-600">
                通話を終了すると、再度開始することはできません。
                {countdownActive && (
                  <span className="block mt-2 font-medium text-red-600">
                    残り時間: {formatTime(remainingTime)}
                  </span>
                )}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowEndConfirmModal(false)}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  setShowEndConfirmModal(false);
                  handleEndCall();
                }}
                disabled={isEnding}
                className="flex-1 px-6 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isEnding ? '終了中...' : '終了する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

