import React, { useEffect, useRef, useState } from 'react';
import DailyIframe from '@daily-co/daily-js';
import { Clock, PhoneOff, Users } from 'lucide-react';
import { endCall, getCallStatus } from '../../api/calls';

interface VideoCallProps {
  roomUrl: string;
  token: string;
  purchasedSlotId: string;
  durationMinutes: number;
  scheduledStartTime: string; // Talk枠の予定開始時刻
  userId: string;
  userType: 'influencer' | 'fan';
  onCallEnd: (duration: number) => void;
}

export default function VideoCall({
  roomUrl,
  token,
  purchasedSlotId,
  durationMinutes,
  scheduledStartTime,
  userId,
  userType,
  onCallEnd,
}: VideoCallProps) {
  const callFrameRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const initializingRef = useRef(false); // 初期化中フラグ
  const scheduledEndTimeRef = useRef<Date | null>(null); // Talk枠の予定終了時刻
  const [isJoined, setIsJoined] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [influencerJoined, setInfluencerJoined] = useState(false);
  const [fanJoined, setFanJoined] = useState(false);
  const [remainingTime, setRemainingTime] = useState(durationMinutes);
  const [isEnding, setIsEnding] = useState(false);
  const [countdownActive, setCountdownActive] = useState(false);
  const [showLeaveWarningModal, setShowLeaveWarningModal] = useState(false);

  // Talk枠の予定終了時刻を計算（初回のみ）
  useEffect(() => {
    if (!scheduledEndTimeRef.current) {
      const startTime = new Date(scheduledStartTime);
      const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
      scheduledEndTimeRef.current = endTime;
      console.log('🔵 Talk枠の予定終了時刻を設定:', endTime.toISOString());
    }
  }, [scheduledStartTime, durationMinutes]);

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
          showLeaveButton: false, // カスタムボタンを使用するため無効化
          showFullscreenButton: true,
          showLocalVideo: true,
          showParticipantsBar: true,
          // コントロールバーを表示（Mute機能を含む）
          showControls: true,
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
          // handleEndCallは既に呼ばれているはずなので、ここでは何もしない
          // （handleEndCallでleaveを呼ぶため、このイベントが発火する）
        });

        callFrame.on('error', (event: any) => {
          console.error('❌ 通話エラー:', event);
          // エラーが発生した場合、ユーザーに通知
          // ただし、既に接続済みの場合はエラーを無視（再接続を試みる）
          if (!isJoined) {
            console.warn('⚠️ 通話エラーが発生しましたが、再接続を試みます');
          }
        });

        // 通話に参加
        await callFrame.join({ url: roomUrl, token: token });

      } catch (error) {
        console.error('❌ 通話初期化エラー:', error);
        initializingRef.current = false;
        // エラーが発生した場合でも、既に接続済みの場合は続行
        // （ページリロード時の再接続を許可）
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

        // 相手が通話を終了した場合、即座に終了処理を実行
        if (status.status === 'completed' && !isEnding) {
          console.log('⚠️ 相手が通話を終了しました - 自動終了');
          handleEndCall();
          return;
        }

        // カウントダウンを開始（予定終了時刻から計算）
        if (!countdownActive && scheduledEndTimeRef.current) {
          console.log('✅ カウントダウン開始（予定終了時刻から計算）');
          setCountdownActive(true);
        }
      } catch (error) {
        console.error('❌ 参加状況取得エラー:', error);
      }
    };

    const interval = setInterval(pollStatus, 2000); // 2秒ごとに確認
    pollStatus(); // 初回実行

    return () => clearInterval(interval);
  }, [isJoined, purchasedSlotId, isEnding]);

  // 残り時間カウントダウン（Talk枠の予定終了時刻から計算）
  useEffect(() => {
    if (!countdownActive || !scheduledEndTimeRef.current) return;

    const timer = setInterval(() => {
      const now = new Date();
      const endTime = scheduledEndTimeRef.current!;
      const remainingMs = endTime.getTime() - now.getTime();
      const newRemainingTime = Math.max(0, remainingMs / (1000 * 60)); // 分単位

      setRemainingTime(newRemainingTime);

      // 時間切れで自動終了
      if (newRemainingTime <= 0) {
        console.log('⏰ 時間切れ - 自動終了');
        handleEndCall();
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [countdownActive]);

  const handleEndCall = async () => {
    if (isEnding) return;
    setIsEnding(true);

    try {
      console.log('🔵 通話終了処理開始:', { purchasedSlotId, userId });
      
      // Daily.coから退出
      if (callFrameRef.current) {
        console.log('🔵 Daily.coから退出開始');
        await callFrameRef.current.leave();
        callFrameRef.current.destroy();
        callFrameRef.current = null;
        console.log('✅ Daily.coから退出完了');
      }

      // バックエンドに通話終了を通知
      console.log('🔵 バックエンドに通話終了を通知:', { purchasedSlotId, userId });
      const result = await endCall(purchasedSlotId, userId);
      console.log('✅ 通話終了成功:', result);
      
      onCallEnd(result.duration);
    } catch (error: any) {
      console.error('❌ 通話終了エラー:', {
        error: error.message,
        stack: error.stack,
        purchasedSlotId,
        userId
      });
      // エラーが発生しても、onCallEndを呼び出して画面遷移を実行
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
            onClick={() => {
              // 時間切れの場合は警告なしで終了
              if (remainingTime <= 0 || !countdownActive) {
                handleEndCall();
              } else {
                // 途中退室の場合は警告を表示
                setShowLeaveWarningModal(true);
              }
            }}
            disabled={isEnding}
            className="flex items-center justify-center gap-2 px-4 py-2 sm:px-6 sm:py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <PhoneOff className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm sm:text-base">{isEnding ? '終了中...' : '終了'}</span>
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

      {/* 途中退室警告モーダル */}
      {showLeaveWarningModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 md:p-8">
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 mb-4">
                <PhoneOff className="h-8 w-8 text-yellow-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                途中退室の確認
              </h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800 font-medium">
                  {userType === 'influencer' ? (
                    <>
                      途中退室すると落札がキャンセルされ、入金されませんが退室されますか？
                    </>
                  ) : (
                    <>
                      途中退室しても落札はキャンセルされず、課金されますが退室されますか？
                    </>
                  )}
                </p>
                {countdownActive && remainingTime > 0 && (
                  <p className="text-xs text-yellow-700 mt-2">
                    残り時間: {formatTime(remainingTime)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowLeaveWarningModal(false)}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  setShowLeaveWarningModal(false);
                  handleEndCall();
                }}
                disabled={isEnding}
                className="flex-1 px-6 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isEnding ? '終了中...' : '退室する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

