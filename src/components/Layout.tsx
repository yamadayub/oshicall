import React, { useEffect, useState } from 'react';
import { Heart, User, Calendar, Video, LogOut, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';

interface LayoutProps {
  children: React.ReactNode;
  onNavigate?: (page: string) => void;
}

export default function Layout({ children, onNavigate }: LayoutProps) {
  const { user, supabaseUser, userType, isLoading, signOut, switchToInfluencerMode } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  // ページ遷移時にスクロール位置をリセット
  useEffect(() => {
    // ウィンドウのスクロール位置をリセット
    window.scrollTo(0, 0);

    // main要素のスクロール位置もリセット
    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.scrollTop = 0;
    }

    // ルート要素のスクロール位置もリセット
    const rootElement = document.documentElement;
    rootElement.scrollTop = 0;
  }, [children]);

  // ロゴ画像の決定
  const getLogoPath = () => {
    // 実際のファイル名を直接指定（優先順位: original > 1200w > 2400w > 600w）
    const logoFiles = [
      'oshi-talk-logo-original.png',
      'oshi-talk-logo-1200w.png',
      'oshi-talk-logo-2400w.png',
      'oshi-talk-logo-600w.png',
      'oshi-talk-logo-1200w.webp'
    ];

    // 最初に見つかったファイルを使用
    for (const fileName of logoFiles) {
      try {
        const img = new Image();
        img.src = `/images/logo/${fileName}`;
        return `/images/logo/${fileName}`;
      } catch (e) {
        // ファイルが存在しない場合は次へ
      }
    }

    // フォールバック
    return '/images/logo/oshi-talk-logo-original.png';
  };

  // ログイン状態に応じてナビゲーション項目を動的に生成
  const navItems = [
    { id: 'home', label: 'ホーム', icon: Calendar },
    ...(user ? [{ id: 'talk', label: 'Talk', icon: Video }] : []),
    ...(user ? [{ id: 'mypage', label: 'マイページ', icon: User }] : []),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-100">
      {/* Fixed Header */}
      <header className="bg-gradient-to-r from-pink-50 via-purple-50 to-indigo-100 fixed top-0 left-0 right-0 z-50 h-12 border-b border-white/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex justify-between items-center h-full">
            <button 
              onClick={() => onNavigate?.('home')}
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity duration-200"
            >
              <Heart className="h-8 w-8 text-pink-500 fill-current" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
                OshiTalk
              </h1>
            </button>
            
            <nav className="hidden md:flex space-x-8">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onNavigate?.(item.id)}
                  className="flex items-center space-x-2 text-gray-600 hover:text-pink-600 transition-colors duration-200 font-medium"
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="flex items-center space-x-4">
              {isLoading ? (
                <div className="h-8 w-8 animate-pulse bg-gray-200 rounded-full"></div>
              ) : user ? (
                <div className="flex items-center space-x-3 relative">
                  {supabaseUser && (
                    <span className="text-xs text-gray-500">
                      {userType === 'fan' ? 'ファン' : 'インフルエンサー'}
                    </span>
                  )}
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="h-8 w-8 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white flex items-center justify-center font-medium hover:from-pink-600 hover:to-purple-700 transition-all"
                  >
                    {supabaseUser?.display_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                  </button>
                  
                  {userMenuOpen && (
                    <div className="absolute right-0 top-12 bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-[220px] z-50">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="font-medium text-gray-900">{supabaseUser?.display_name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                        <p className="text-xs text-pink-600 font-medium mt-1">
                          {userType === 'fan' ? 'ファン' : 'インフルエンサー'}
                        </p>
                      </div>
                      
                      
                      {userType === 'fan' && supabaseUser?.is_influencer && (
                        <button
                          onClick={async () => {
                            try {
                              setSwitching(true);
                              await switchToInfluencerMode();
                              setUserMenuOpen(false);
                              onNavigate?.('mypage');
                            } catch (error: any) {
                              alert(error.message || 'インフルエンサーへの切り替えに失敗しました');
                            } finally {
                              setSwitching(false);
                            }
                          }}
                          disabled={switching}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2 disabled:opacity-50"
                        >
                          <Sparkles className="h-4 w-4" />
                          <span>{switching ? '切り替え中...' : 'インフルエンサーモード'}</span>
                        </button>
                      )}
                      
                      <div className="border-t border-gray-100 my-1"></div>
                      
                      <button
                        onClick={() => {
                          signOut();
                          setUserMenuOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>ログアウト</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex space-x-2">
                  <button 
                    onClick={() => {
                      setAuthMode('signin');
                      setAuthModalOpen(true);
                    }}
                    className="px-4 py-2 text-sm font-medium text-pink-600 hover:text-pink-700 transition-colors"
                  >
                    ログイン
                  </button>
                  <button 
                    onClick={() => {
                      setAuthMode('signup');
                      setAuthModalOpen(true);
                    }}
                    className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all duration-200 shadow-md"
                  >
                    新規登録
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Body Content Area */}
      <main className="pt-12 pb-16 md:pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {children}
        </div>
        
        {/* Mobile Footer - Fixed to bottom */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gradient-to-r from-pink-50 via-purple-50 to-indigo-100 border-t border-white/20 shadow-lg backdrop-blur-sm z-40">
          <div className="flex justify-evenly h-12">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate?.(item.id)}
                className="flex flex-col items-center justify-center text-gray-600 hover:text-pink-600 transition-colors duration-200 flex-1"
              >
                <item.icon className="h-4 w-4 mb-0.5" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </main>
      
      <AuthModal 
        isOpen={authModalOpen} 
        onClose={() => setAuthModalOpen(false)} 
        mode={authMode}
      />
    </div>
  );
}