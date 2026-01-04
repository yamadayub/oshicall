// インフルエンサー売上ダッシュボードコンポーネント
import React, { useEffect, useState } from 'react';
import { getInfluencerEarnings, createStripeDashboardLink } from '../api/stripe';

interface EarningsData {
  totalEarnings: number;      // Transfer済み（総売上）
  pendingPayout: number;      // Capture済み、Transfer未実施（入金予定額）
  availableBalance: number;   // Stripe残高（参考情報）
  pendingBalance: number;     // Stripe保留中（参考情報）
  recentTransactions: Array<{
    id: string;
    talkTitle: string;
    amount: number;
    platformFee: number;
    grossAmount: number;
    completedAt: string;
    status: string;
  }>;
  monthlyStats: {
    currentMonth: {
      earnings: number;
      callCount: number;
      averagePrice: number;
    };
    previousMonth: {
      earnings: number;
      callCount: number;
    };
  };
  totalCallCount: number;
  balanceError?: string | null;
}

interface Props {
  authUserId: string;
}

export const InfluencerEarningsDashboard: React.FC<Props> = ({ authUserId }) => {
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isOpeningDashboard, setIsOpeningDashboard] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); // アコーディオンの開閉状態（デフォルト閉じる）

  useEffect(() => {
    loadEarnings();
  }, [authUserId]);

  const loadEarnings = async () => {
    try {
      setIsLoading(true);
      setError('');
      const data = await getInfluencerEarnings(authUserId);
      setEarnings(data);
    } catch (err: any) {
      console.error('売上データ取得エラー:', err);
      setError(err.message || '売上データの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenStripeDashboard = async () => {
    try {
      setIsOpeningDashboard(true);

      // ポップアップブロッカー対策: Safari等では非同期処理後のwindow.openがブロックされることがあるため
      // ユーザーアクションの直後にウィンドウを開いておく（後でURLを設定）
      // ただし、モバイルの場合は別タブではなく現在のタブで遷移した方が良い場合もある

      const { url, is_onboarding } = await createStripeDashboardLink(authUserId);

      if (!url) {
        throw new Error('URLが取得できませんでした');
      }

      console.log('🔗 Stripe Redirect:', { url, is_onboarding });

      // オンボーディング（未完了）の場合は、元の画面に戻ってくる必要があるため
      // 現在のタブで遷移する（またはリダイレクトループを防ぐ）
      if (is_onboarding) {
        window.location.href = url;
        // ページ遷移時はローディング状態を解除しない（画面が切り替わるまで表示維持）
        return;
      } else {
        // Dashboard（完了済み）の場合は別タブで開く
        // 非同期処理後なので、window.openがブロックされる可能性がある
        // 失敗した場合は現在のタブで開く
        const newWindow = window.open(url, '_blank');
        if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
          window.location.href = url;
          // フォールバックでページ遷移する場合もローディング維持
          return;
        }

        // 別タブで開けた場合はローディング解除
        setIsOpeningDashboard(false);
      }
    } catch (err: any) {
      console.error('Dashboard リンク生成エラー:', err);
      alert('詳細画面への遷移に失敗しました: ' + (err.message || '不明なエラー'));
      setIsOpeningDashboard(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="animate-pulse flex justify-between items-center">
          <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadEarnings}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-black transition-colors"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  if (!earnings) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300">
      {/* ヘッダー（クリックで開閉） */}
      <div
        className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-5 cursor-pointer hover:bg-gray-50/80 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-gray-100 text-gray-600' : 'bg-transparent text-gray-400'}`}>
            <span className={`transform transition-transform duration-300 block ${isExpanded ? 'rotate-90' : 'rotate-0'}`}>
              ▶
            </span>
          </div>
          <div>
            <h2 className="text-lg font-medium text-gray-900">売上サマリー</h2>
            {!isExpanded && (
              <p className="text-sm text-gray-500 mt-0.5">
                総売上: {formatCurrency(earnings.totalEarnings)}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation(); // 親のクリックイベントを防ぐ
            handleOpenStripeDashboard();
          }}
          disabled={isOpeningDashboard}
          className="text-sm text-gray-500 hover:text-gray-900 underline underline-offset-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {isOpeningDashboard ? 'ページ遷移中...' : 'さらに詳細を確認'}
        </button>
      </div>

      {/* コンテンツ（開いている時のみ表示） */}
      {isExpanded && (
        <div className="px-4 sm:px-6 pb-6 pt-0">

          {/* 残高取得エラー警告 */}
          {earnings.balanceError && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs sm:text-sm text-yellow-800">
                <span className="font-medium whitespace-nowrap">⚠️ 残高情報が取得できませんでした</span>
                <br />
                <span className="text-xs mt-1 block">
                  テストモードのStripe Connectアカウントでは実際の残高は表示されません。
                  詳細はStripe Dashboardをご確認ください。
                </span>
              </p>
            </div>
          )}

          {/* サマリーカード */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
            {/* 総売上 */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 sm:p-6 rounded-lg border border-green-200">
              <div className="text-xs sm:text-sm text-green-700 font-medium mb-1 whitespace-nowrap">総売上（受取額）</div>
              <div className="text-2xl sm:text-3xl font-bold text-green-900 whitespace-nowrap overflow-hidden text-ellipsis">
                {formatCurrency(earnings.totalEarnings)}
              </div>
              <div className="text-xs text-green-600 mt-2 whitespace-nowrap">
                {earnings.totalCallCount}件の通話完了
              </div>
            </div>

            {/* 入金予定額 */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 sm:p-6 rounded-lg border border-blue-200">
              <div className="text-xs sm:text-sm text-blue-700 font-medium mb-1 whitespace-nowrap">入金予定額</div>
              <div className="text-2xl sm:text-3xl font-bold text-blue-900 whitespace-nowrap overflow-hidden text-ellipsis">
                {formatCurrency(earnings.pendingPayout)}
              </div>
              <div className="text-xs text-blue-600 mt-2 whitespace-nowrap">
                Capture済み、送金待ち
              </div>
            </div>

            {/* 入金可能額 */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 sm:p-6 rounded-lg border border-purple-200">
              <div className="text-xs sm:text-sm text-purple-700 font-medium mb-1 whitespace-nowrap">入金可能額</div>
              <div className="text-2xl sm:text-3xl font-bold text-purple-900 whitespace-nowrap overflow-hidden text-ellipsis">
                {formatCurrency(earnings.availableBalance)}
              </div>
              <div className="text-xs text-purple-600 mt-2 whitespace-nowrap">
                即時出金可能
              </div>
            </div>
          </div>

          {/* 今月の売上 */}
          <div className="mb-6 sm:mb-8">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 whitespace-nowrap">📊 今月の実績</h3>
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                <div className="text-xs sm:text-sm text-gray-600 mb-1 whitespace-nowrap">今月の売上</div>
                <div className="text-base sm:text-xl font-bold text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis">
                  {formatCurrency(earnings.monthlyStats.currentMonth.earnings)}
                </div>
              </div>
              <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                <div className="text-xs sm:text-sm text-gray-600 mb-1 whitespace-nowrap">通話回数</div>
                <div className="text-base sm:text-xl font-bold text-gray-900 whitespace-nowrap">
                  {earnings.monthlyStats.currentMonth.callCount}回
                </div>
              </div>
              <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                <div className="text-xs sm:text-sm text-gray-600 mb-1 whitespace-nowrap">平均単価</div>
                <div className="text-base sm:text-xl font-bold text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis">
                  {formatCurrency(earnings.monthlyStats.currentMonth.averagePrice)}
                </div>
              </div>
            </div>

            {/* 前月比較 */}
            {earnings.monthlyStats.previousMonth.callCount > 0 && (
              <div className="mt-3 sm:mt-4 text-xs sm:text-sm text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis">
                前月: {formatCurrency(earnings.monthlyStats.previousMonth.earnings)}
                （{earnings.monthlyStats.previousMonth.callCount}回）
                {earnings.monthlyStats.currentMonth.earnings > earnings.monthlyStats.previousMonth.earnings && (
                  <span className="text-green-600 ml-2">
                    ↑ {formatCurrency(earnings.monthlyStats.currentMonth.earnings - earnings.monthlyStats.previousMonth.earnings)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 直近の取引履歴 */}
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 whitespace-nowrap">📝 直近の取引</h3>
            {earnings.recentTransactions.length === 0 ? (
              <p className="text-gray-500 text-center py-6 sm:py-8 text-sm sm:text-base">まだ取引がありません</p>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {earnings.recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-0 p-3 sm:p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm sm:text-base truncate">{tx.talkTitle}</div>
                      <div className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">
                        {formatDate(tx.completedAt)}
                      </div>
                    </div>
                    <div className="text-left sm:text-right flex-shrink-0">
                      <div className="font-bold text-gray-900 text-base sm:text-lg whitespace-nowrap">
                        {formatCurrency(tx.amount)}
                      </div>
                      <div className="text-xs text-gray-500 whitespace-nowrap">
                        総額: {formatCurrency(tx.grossAmount)} (手数料: {formatCurrency(tx.platformFee)})
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ヘルプテキスト */}
          <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-xs sm:text-sm text-blue-900">
              <p className="font-medium mb-2 whitespace-nowrap">💡 入金について</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800 text-xs sm:text-sm">
                <li>毎週月曜日に前週の売上が確定します</li>
                <li>確定から7営業日後に銀行口座へ入金されます</li>
                <li>詳細な入金履歴は「詳細を見る」ボタンから確認できます</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
