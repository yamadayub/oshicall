import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, DollarSign, Phone, Star, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface FanProfileData {
  id: string;
  display_name: string;
  profile_image_url: string | null;
  bio: string | null;
  created_at: string;
}

interface PurchaseHistory {
  id: string;
  purchased_at: string;
  winning_bid_amount: number;
  call_status: string;
  call_actual_duration_minutes: number | null;
  call_slots: {
    id: string;
    title: string;
    scheduled_start_time: string;
    duration_minutes: number;
    thumbnail_url: string | null;
  };
}

export default function FanProfile() {
  const { fanId } = useParams<{ fanId: string }>();
  const navigate = useNavigate();
  const { supabaseUser } = useAuth();
  const [fan, setFan] = useState<FanProfileData | null>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistory[]>([]);
  const [stats, setStats] = useState({
    totalPurchases: 0,
    totalSpent: 0,
    completedTalks: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFanData = async () => {
      if (!fanId || !supabaseUser) {
        navigate('/talk');
        return;
      }

      try {
        setIsLoading(true);

        // ファンのプロフィールを取得
        const { data: fanData, error: fanError } = await supabase
          .from('users')
          .select('id, display_name, profile_image_url, bio, created_at')
          .eq('id', fanId)
          .single();

        if (fanError || !fanData) {
          console.error('ファン取得エラー:', fanError);
          navigate('/talk');
          return;
        }

        setFan(fanData);

        // このファンが購入したTalkの履歴を取得（インフルエンサーが自分のもののみ）
        const { data: purchases, error: purchasesError } = await supabase
          .from('purchased_slots')
          .select(`
            id,
            purchased_at,
            winning_bid_amount,
            call_status,
            call_actual_duration_minutes,
            call_slots (
              id,
              title,
              scheduled_start_time,
              duration_minutes,
              thumbnail_url
            )
          `)
          .eq('fan_user_id', fanId)
          .eq('influencer_user_id', supabaseUser.id)
          .order('purchased_at', { ascending: false });

        if (purchasesError) {
          console.error('購入履歴取得エラー:', purchasesError);
        }

        const validPurchases = (purchases || []).filter(p => p.call_slots) as PurchaseHistory[];
        setPurchaseHistory(validPurchases);

        // 統計を計算
        const totalPurchases = validPurchases.length;
        const totalSpent = validPurchases.reduce((sum, p) => sum + (p.winning_bid_amount || 0), 0);
        const completedTalks = validPurchases.filter(p => p.call_status === 'completed').length;

        setStats({
          totalPurchases,
          totalSpent,
          completedTalks,
        });
      } catch (err) {
        console.error('❌ データ取得エラー:', err);
        navigate('/talk');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFanData();
  }, [fanId, supabaseUser, navigate]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ja-JP').format(price);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">完了</span>;
      case 'in_progress':
        return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">進行中</span>;
      case 'pending':
        return <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-medium">予定</span>;
      default:
        return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-medium">{status}</span>;
    }
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

  if (!fan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😞</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">ファンが見つかりません</h2>
          <button
            onClick={() => navigate('/talk')}
            className="px-6 py-3 bg-pink-500 text-white rounded-lg hover:bg-pink-600"
          >
            Talkページに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-6">
      {/* Back Button */}
      <button
        onClick={() => navigate('/talk')}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-5 w-5" />
        <span>Talkページに戻る</span>
      </button>

      {/* Fan Profile Header */}
      <div className="bg-gradient-to-r from-pink-50 via-purple-50 to-indigo-100 rounded-xl p-6 border-2 border-pink-200 shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-6">
          <img
            src={fan.profile_image_url || '/images/default-avatar.png'}
            alt={fan.display_name}
            className="h-24 w-24 md:h-32 md:w-32 rounded-full border-4 border-white shadow-lg object-cover flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 truncate">
                {fan.display_name}
              </h1>
              <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold flex-shrink-0">
                落札者
              </span>
            </div>
            {fan.bio && (
              <p className="text-gray-700 mb-4 line-clamp-3">{fan.bio}</p>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="flex items-center justify-center mb-1">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div className="text-xs text-gray-600 mb-1">総支払額</div>
                <div className="text-lg font-bold text-green-600">¥{formatPrice(stats.totalSpent)}</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="flex items-center justify-center mb-1">
                  <Phone className="h-5 w-5 text-blue-600" />
                </div>
                <div className="text-xs text-gray-600 mb-1">購入回数</div>
                <div className="text-lg font-bold text-blue-600">{stats.totalPurchases}回</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="flex items-center justify-center mb-1">
                  <Star className="h-5 w-5 text-yellow-500" />
                </div>
                <div className="text-xs text-gray-600 mb-1">完了</div>
                <div className="text-lg font-bold text-purple-600">{stats.completedTalks}回</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Purchase History */}
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center space-x-2 mb-4">
          <Calendar className="h-6 w-6 text-pink-500" />
          <span>購入履歴</span>
        </h2>

        {purchaseHistory.length === 0 ? (
          <div className="text-center py-12 bg-gradient-to-br from-pink-50 to-purple-50 rounded-xl border-2 border-pink-200">
            <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">このファンからの購入履歴はまだありません</p>
          </div>
        ) : (
          <div className="space-y-4">
            {purchaseHistory.map((purchase) => (
              <div
                key={purchase.id}
                className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col md:flex-row md:items-center space-y-3 md:space-y-0 md:space-x-4">
                  <img
                    src={purchase.call_slots.thumbnail_url || '/images/talks/default.jpg'}
                    alt={purchase.call_slots.title}
                    className="h-20 w-20 rounded-lg object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 mb-1">{purchase.call_slots.title}</h3>
                    <div className="flex flex-wrap gap-2 text-sm text-gray-600">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(purchase.call_slots.scheduled_start_time)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <DollarSign className="h-4 w-4" />
                        <span>¥{formatPrice(purchase.winning_bid_amount)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {getStatusBadge(purchase.call_status)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
