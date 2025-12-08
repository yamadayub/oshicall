import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Clock, DollarSign, Users, Eye, EyeOff, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import CreateCallSlotForm from '../components/CreateCallSlotForm';
import { getInfluencerCallSlots, deleteCallSlot, toggleCallSlotPublish } from '../api/callSlots';
import type { CallSlot, User } from '../lib/supabase';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

export default function InfluencerDashboard() {
  const { supabaseUser, userType } = useAuth();
  const [callSlots, setCallSlots] = useState<CallSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState('');

  const currentUser = userType === 'influencer' ? supabaseUser : null;

  useEffect(() => {
    if (currentUser) {
      loadCallSlots();
    }
  }, [currentUser]);

  const loadCallSlots = async () => {
    if (!currentUser) return;

    try {
      setIsLoading(true);
      const slots = await getInfluencerCallSlots(currentUser.id);
      setCallSlots(slots);
    } catch (err) {
      console.error('Talk枠取得エラー:', err);
      setError('Talk枠の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSuccess = () => {
    setShowCreateForm(false);
    loadCallSlots();
  };

  const handleDelete = async (callSlotId: string) => {
    if (!confirm('このTalk枠を削除してもよろしいですか？')) return;

    try {
      await deleteCallSlot(callSlotId);
      loadCallSlots();
    } catch (err) {
      console.error('削除エラー:', err);
      alert('Talk枠の削除に失敗しました');
    }
  };

  const handleTogglePublish = async (callSlotId: string, currentStatus: boolean) => {
    try {
      await toggleCallSlotPublish(callSlotId, !currentStatus);
      loadCallSlots();
    } catch (err) {
      console.error('公開状態変更エラー:', err);
      alert('公開状態の変更に失敗しました');
    }
  };

  if (!currentUser) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-600">インフルエンサーとしてログインしてください</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-6">
      {/* ヘッダー (Minimal: Title removed, Create button moved/styled) */}
      <div className="flex justify-end items-center mb-6">
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-all duration-200 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Talk枠を作成</span>
        </button>
      </div>

      {/* 統計カード (Minimal Design) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">総収益</p>
          <p className="text-xl font-bold text-gray-900">
            ¥{currentUser.total_earnings.toLocaleString()}
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">完了数</p>
          <p className="text-xl font-bold text-gray-900">
            {currentUser.total_calls_completed}
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">評価</p>
          <div className="flex items-center space-x-1">
            <span className="text-xl font-bold text-gray-900">{currentUser.average_rating?.toFixed(1) || '-'}</span>
            <span className="text-sm">⭐</span>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">枠数</p>
          <p className="text-xl font-bold text-gray-900">
            {callSlots.length}
          </p>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Talk枠一覧 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Talk枠一覧</h2>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-gray-100 h-24 rounded-lg"></div>
            ))}
          </div>
        ) : callSlots.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600">まだTalk枠がありません</p>
            <p className="text-sm text-gray-500 mt-2">
              「新しいTalk枠を作成」ボタンから作成できます
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {callSlots.map((slot) => (
              <div
                key={slot.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-lg font-bold text-gray-900">{slot.title}</h3>
                      {slot.is_published ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                          公開中
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                          非公開
                        </span>
                      )}
                    </div>

                    {slot.description && (
                      <p className="text-sm text-gray-600 mb-3">{slot.description}</p>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="flex items-center space-x-2 text-gray-600">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {format(new Date(slot.scheduled_start_time), 'MM/dd HH:mm', {
                            locale: ja,
                          })}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 text-gray-600">
                        <Clock className="h-4 w-4" />
                        <span>{slot.duration_minutes}分</span>
                      </div>

                      <div className="flex items-center space-x-2 text-gray-600">
                        <DollarSign className="h-4 w-4" />
                        <span>¥{slot.starting_price.toLocaleString()}</span>
                      </div>

                      <div className="text-gray-600">
                        <span className="text-xs">最小入札: ¥{slot.minimum_bid_increment}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => handleTogglePublish(slot.id, slot.is_published)}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title={slot.is_published ? '非公開にする' : '公開する'}
                    >
                      {slot.is_published ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>

                    <button
                      onClick={() => handleDelete(slot.id)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="削除"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 作成フォーム */}
      {showCreateForm && (
        <CreateCallSlotForm
          influencerId={currentUser.id}
          onSuccess={handleCreateSuccess}
          onCancel={() => setShowCreateForm(false)}
        />
      )}
    </div>
  );
}

