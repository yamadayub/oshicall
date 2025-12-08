import React from 'react';
import { CheckCircle, Clock, Star, Home } from 'lucide-react';

interface CallCompletedScreenProps {
  userType: 'influencer' | 'fan';
  duration: number;
  influencerName?: string;
  influencerImage?: string;
  title: string;
  onNavigate: () => void;
}

export default function CallCompletedScreen({
  userType,
  duration,
  influencerName,
  influencerImage,
  title,
  onNavigate,
}: CallCompletedScreenProps) {
  const formatDuration = (minutes: number) => {
    const mins = Math.floor(minutes);
    const secs = Math.floor((minutes - mins) * 60);
    return `${mins}分${secs}秒`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
        {/* アイコン */}
        <div className="mb-6">
          <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>
        </div>

        {/* タイトル */}
        <h2 className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent mb-2">
          通話が終了しました
        </h2>
        <p className="text-gray-600 mb-6">
          {title}
        </p>

        {/* インフルエンサー情報（ファンの場合のみ） */}
        {userType === 'fan' && influencerName && (
          <div className="mb-6 p-4 bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl">
            <div className="flex items-center justify-center space-x-3 mb-2">
              {influencerImage && (
                <img
                  src={influencerImage}
                  alt={influencerName}
                  className="w-12 h-12 rounded-full object-cover"
                />
              )}
              <span className="font-medium text-gray-900">{influencerName}</span>
            </div>
            <p className="text-sm text-gray-600">との通話</p>
          </div>
        )}

        {/* 通話時間 */}
        <div className="mb-8 p-6 bg-gray-50 rounded-xl">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <Clock className="h-5 w-5 text-blue-500" />
            <span className="text-sm text-gray-600">通話時間</span>
          </div>
          <div className="text-4xl font-bold text-gray-900">
            {formatDuration(duration)}
          </div>
        </div>

        {/* メッセージ */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
          <p className="text-sm text-blue-800">
            {userType === 'influencer'
              ? '✨ 素敵な時間をありがとうございました！'
              : '✨ 楽しい時間をありがとうございました！'
            }
          </p>
        </div>

        {/* レビューのお願い（ファンの場合のみ） */}
        {userType === 'fan' && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-100 rounded-lg">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <Star className="h-5 w-5 text-yellow-500" />
              <span className="text-sm font-medium text-yellow-900">レビューをお願いします</span>
            </div>
            <p className="text-sm text-yellow-800">
              次のステップでレビューを投稿できます
            </p>
          </div>
        )}

        {/* ボタン */}
        <button
          onClick={onNavigate}
          className="w-full flex items-center justify-center space-x-2 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-bold text-lg hover:from-pink-600 hover:to-purple-700 transition-all duration-200 shadow-lg transform hover:scale-105 whitespace-normal h-auto"
        >
          <Home className="h-5 w-5 flex-shrink-0" />
          <span>
            {userType === 'influencer' ? 'ダッシュボードに戻る' : '次へ進む'}
          </span>
        </button>

        {/* 統計情報 */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            この通話は自動的に記録されました
          </p>
        </div>
      </div>
    </div>
  );
}
