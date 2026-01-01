import React, { useState, useEffect, useMemo } from 'react';
import { Video, Mic, Clock, Users, AlertCircle, CheckCircle } from 'lucide-react';
import { createCallRoom, getCallStatus, type CreateRoomResponse } from '../../api/calls';

interface CallWaitingRoomProps {
  purchasedSlotId: string;
  userId: string;
  userType: 'influencer' | 'fan';
  scheduledStartTime: string;
  durationMinutes: number;
  title: string;
  onJoinCall: (roomUrl: string, token: string) => void;
}

export default function CallWaitingRoom({
  purchasedSlotId,
  userId,
  userType,
  scheduledStartTime,
  durationMinutes,
  title,
  onJoinCall,
}: CallWaitingRoomProps) {
  const [roomData, setRoomData] = useState<CreateRoomResponse | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cameraPermission, setCameraPermission] = useState<boolean>(false);
  const [micPermission, setMicPermission] = useState<boolean>(false);
  const [timeUntilStart, setTimeUntilStart] = useState<number>(0);
  const [canJoin, setCanJoin] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // ルーム作成
  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);
        console.log('🔵 CallWaitingRoom: ルーム作成開始', { purchasedSlotId, userId, userType });
        const result = await createCallRoom(purchasedSlotId, userId);
        console.log('✅ CallWaitingRoom: ルーム作成成功', result);
        setRoomData(result);
        setTimeUntilStart(result.timeUntilStart);
        // 開始時刻になったら入室可能（0秒以下）
        setCanJoin(result.timeUntilStart <= 0);
        setLoading(false);
      } catch (err: any) {
        console.error('❌ CallWaitingRoom: ルーム作成エラー', err);
        setError(err.message || 'ルーム作成に失敗しました');
        setLoading(false);
      }
    };

    initialize();
  }, [purchasedSlotId, userId, userType]);

  // ステータスポーリング
  useEffect(() => {
    const pollStatus = async () => {
      try {
        const statusData = await getCallStatus(purchasedSlotId);
        setStatus(statusData);
        setTimeUntilStart(statusData.time_until_start_seconds);
        setCanJoin(statusData.can_join);
      } catch (err) {
        console.error('ステータス取得エラー:', err);
      }
    };

    const interval = setInterval(pollStatus, 5000);
    pollStatus(); // 初回実行

    return () => clearInterval(interval);
  }, [purchasedSlotId]);

  // カメラ・マイク許可チェック
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        setCameraPermission(true);
        setMicPermission(true);
        stream.getTracks().forEach(track => track.stop()); // 停止
      } catch (err) {
        console.warn('カメラ・マイク許可が必要です');
      }
    };

    checkPermissions();
  }, []);

  // カウントダウンタイマー
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeUntilStart(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // インフルエンサー/ファンの通話開始可能判定
  const canStartCall = useMemo(() => {
    if (!status) return false;
    
    const timeUntilStartSeconds = status.time_until_start_seconds || timeUntilStart;
    
    if (userType === 'influencer') {
      // インフルエンサー: 15分前（900秒前）から開始可能
      return timeUntilStartSeconds <= 15 * 60;
    } else {
      // ファン: 開始時刻から（自動接続のため、ボタンは表示しない）
      return timeUntilStartSeconds <= 0;
    }
  }, [status, userType, timeUntilStart]);

  // ファンの自動接続（BR-010対応）
  useEffect(() => {
    if (!status || userType !== 'fan') return;
    if (isJoining) return; // 既に接続処理中
    if (!roomData) return; // ルームデータが準備できていない
    
    const timeUntilStartSeconds = status.time_until_start_seconds || timeUntilStart;
    
    // 開始時刻を過ぎたら自動接続
    if (timeUntilStartSeconds <= 0 && !status.participants?.fan_joined) {
      console.log('🔵 ファン: 開始時刻になったため自動接続を開始');
      setIsJoining(true);
      
      const autoJoin = async () => {
        try {
          // 通話開始時に参加情報を記録
          const { getBackendUrl } = await import('../../lib/backend');
          const backendUrl = getBackendUrl();
          const response = await fetch(`${backendUrl}/api/calls/join-room`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ purchasedSlotId, userId }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '参加記録に失敗しました');
          }

          console.log('✅ 通話参加を記録しました（自動接続）');

          // Daily.coルームに参加
          onJoinCall(roomData.roomUrl, roomData.token);
        } catch (err: any) {
          console.error('❌ 自動接続エラー:', err);
          setError(err.message || '自動接続に失敗しました');
          setIsJoining(false);
        }
      };
      
      autoJoin();
    }
  }, [status, userType, timeUntilStart, isJoining, roomData, purchasedSlotId, userId, onJoinCall]);

  const formatCountdown = (seconds: number) => {
    if (seconds <= 0) return '通話時間になりました';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}時間${minutes}分${secs}秒`;
    } else if (minutes > 0) {
      return `${minutes}分${secs}秒`;
    } else {
      return `${secs}秒`;
    }
  };

  const handleJoinClick = async () => {
    if (!roomData) return;
    if (isJoining) return; // 既に接続処理中

    try {
      setIsJoining(true);
      
      // 通話開始時に参加情報を記録
      const { getBackendUrl } = await import('../../lib/backend');
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/api/calls/join-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchasedSlotId, userId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '参加記録に失敗しました');
      }

      console.log('✅ 通話参加を記録しました');

      // Daily.coルームに参加
      onJoinCall(roomData.roomUrl, roomData.token);
    } catch (err: any) {
      console.error('❌ 参加記録エラー:', err);
      setError(err.message || '参加処理に失敗しました');
      setIsJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600">通話ルームを準備中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">エラー</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-pink-500 text-white rounded-lg hover:bg-pink-600"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* タイトル */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent mb-2">
            {title || '通話待機中'}
          </h1>
          <p className="text-gray-600">
            {userType === 'influencer' ? 'インフルエンサー' : 'ファン'}として参加
          </p>
        </div>

        {/* カウントダウン */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6 text-center">
          <Clock className="h-16 w-16 text-pink-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            通話まで
          </h2>
          <div className="text-5xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent mb-4">
            {formatCountdown(timeUntilStart)}
          </div>
          <p className="text-gray-600">
            {new Date(scheduledStartTime).toLocaleString('ja-JP', {
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })} から {durationMinutes}分間
          </p>
        </div>

        {/* デバイスチェック */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">接続チェック</h3>

          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <Video className={`h-5 w-5 ${cameraPermission ? 'text-green-500' : 'text-gray-400'}`} />
              <span className="flex-1 text-gray-700">カメラ</span>
              {cameraPermission ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              )}
            </div>

            <div className="flex items-center space-x-3">
              <Mic className={`h-5 w-5 ${micPermission ? 'text-green-500' : 'text-gray-400'}`} />
              <span className="flex-1 text-gray-700">マイク</span>
              {micPermission ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              )}
            </div>

            <div className="flex items-center space-x-3">
              <Users className={`h-5 w-5 ${status?.room_created ? 'text-green-500' : 'text-gray-400'}`} />
              <span className="flex-1 text-gray-700">通話ルーム</span>
              {status?.room_created ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-pink-500"></div>
              )}
            </div>
          </div>

          {!cameraPermission || !micPermission && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                💡 カメラとマイクの許可が必要です。ブラウザの設定を確認してください。
              </p>
            </div>
          )}
        </div>

        {/* 参加者状況 */}
        {status && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">参加状況</h3>

            <div className="grid grid-cols-2 gap-4">
              {/* インフルエンサーの状態 */}
              <div className={`p-4 rounded-lg border-2 ${
                status.influencer_status === '通話中' ? 'border-green-500 bg-green-50' :
                status.influencer_status === '待機中' ? 'border-blue-500 bg-blue-50' :
                'border-gray-200 bg-gray-50'
              }`}>
                <p className="text-sm text-gray-600 mb-1">インフルエンサー</p>
                <p className="font-bold text-gray-900">
                  {status.influencer_status === '通話中' && '✅ 通話中'}
                  {status.influencer_status === '待機中' && '⏳ 待機中'}
                  {status.influencer_status === '未入室' && '⭕ 未入室'}
                </p>
                {userType === 'influencer' && (
                  <p className="text-xs text-gray-500 mt-1">（あなた）</p>
                )}
              </div>

              {/* ファンの状態 */}
              <div className={`p-4 rounded-lg border-2 ${
                status.fan_status === '通話中' ? 'border-green-500 bg-green-50' :
                status.fan_status === '待機中' ? 'border-blue-500 bg-blue-50' :
                'border-gray-200 bg-gray-50'
              }`}>
                <p className="text-sm text-gray-600 mb-1">ファン</p>
                <p className="font-bold text-gray-900">
                  {status.fan_status === '通話中' && '✅ 通話中'}
                  {status.fan_status === '待機中' && '⏳ 待機中'}
                  {status.fan_status === '未入室' && '⭕ 未入室'}
                </p>
                {userType === 'fan' && (
                  <p className="text-xs text-gray-500 mt-1">（あなた）</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 入室ボタン */}
        {userType === 'influencer' ? (
          // インフルエンサー: 15分前からボタンが有効
          <>
            <button
              onClick={handleJoinClick}
              disabled={!canStartCall || !cameraPermission || !micPermission || isJoining}
              className="w-full py-6 md:py-6 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-2xl font-bold text-lg md:text-xl hover:from-pink-600 hover:to-purple-700 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 disabled:transform-none flex flex-col md:flex-row items-center justify-center gap-2 whitespace-normal h-auto min-h-[80px]"
            >
              {isJoining ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  接続中...
                </span>
              ) : canStartCall ? (
                <span className="flex items-center gap-2">🎥 通話を開始する</span>
              ) : (
                <span className="text-center">⏰ {formatCountdown(timeUntilStart)}後に開始できます</span>
              )}
            </button>
            {!canStartCall && timeUntilStart > 0 && (
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 text-center">
                  💡 待機室に入室しています。相手の参加状況を確認できます。<br />
                  通話開始時刻の15分前から通話を開始できます。
                </p>
              </div>
            )}
          </>
        ) : (
          // ファン: 開始時刻前は自動接続メッセージ、開始時刻後は接続済みまたは接続中
          <>
            {timeUntilStart > 0 ? (
              <div className="w-full py-6 md:py-6 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold text-lg md:text-xl flex flex-col md:flex-row items-center justify-center gap-2 whitespace-normal h-auto min-h-[80px]">
                <span className="text-center">⏰ 開始時刻になると自動的に接続されます</span>
              </div>
            ) : isJoining ? (
              <div className="w-full py-6 md:py-6 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-2xl font-bold text-lg md:text-xl flex flex-col md:flex-row items-center justify-center gap-2 whitespace-normal h-auto min-h-[80px]">
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  自動接続中...
                </span>
              </div>
            ) : status?.participants?.fan_joined ? (
              <div className="w-full py-6 md:py-6 py-4 bg-green-500 text-white rounded-2xl font-bold text-lg md:text-xl flex flex-col md:flex-row items-center justify-center gap-2 whitespace-normal h-auto min-h-[80px]">
                <span className="flex items-center gap-2">✅ 接続済み</span>
              </div>
            ) : (
              <button
                onClick={handleJoinClick}
                disabled={!cameraPermission || !micPermission || isJoining}
                className="w-full py-6 md:py-6 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-2xl font-bold text-lg md:text-xl hover:from-pink-600 hover:to-purple-700 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 disabled:transform-none flex flex-col md:flex-row items-center justify-center gap-2 whitespace-normal h-auto min-h-[80px]"
              >
                {isJoining ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    接続中...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">🎥 通話を開始する</span>
                )}
              </button>
            )}
            {timeUntilStart > 0 && (
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 text-center">
                  💡 待機室に入室しています。相手の参加状況を確認できます。<br />
                  開始時刻になると自動的に通話が開始されます。
                </p>
              </div>
            )}
          </>
        )}

        {/* 注意事項 */}
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h3 className="font-bold text-gray-900 mb-3">📝 通話の注意事項</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>• 待機室にはいつでも入室できます</li>
            <li>• 通話は予定時刻になると開始できます</li>
            <li>• カメラとマイクの許可が必要です</li>
            <li>• 通話時間は{durationMinutes}分です</li>
            <li>• 時間になると自動的に終了します</li>
            <li>• お互いを尊重し、楽しい時間をお過ごしください</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

