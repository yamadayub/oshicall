import React, { createContext, useContext, useState, useEffect } from 'react';
import { User as AuthUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getUserType, registerUser, getSupabaseUser, switchToInfluencer } from '../lib/auth';
import type { User } from '../lib/supabase';

interface AuthContextType {
  user: AuthUser | null;
  supabaseUser: User | null;
  userType: 'fan' | 'influencer' | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  switchToInfluencerMode: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [userType, setUserType] = useState<'fan' | 'influencer' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 初回セッションチェック
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('🔍 初回セッションチェック:', session);
      setUser(session?.user ?? null);
      if (session?.user) {
        syncUser(session.user);
      } else {
        setIsLoading(false);
      }
    });

    // 認証状態の変化を監視
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 認証状態変化:', {
        event,
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id,
        userEmail: session?.user?.email
      });
      setUser(session?.user ?? null);
      if (session?.user) {
        console.log('🔄 セッションあり - syncUserを呼び出し');
        syncUser(session.user);
      } else {
        console.log('🔄 セッションなし - 状態をクリア');
        setSupabaseUser(null);
        setUserType(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const syncUser = async (authUser: AuthUser) => {
    try {
      console.log('🔄 syncUser関数開始:', {
        authUserId: authUser.id,
        email: authUser.email,
        metadata: authUser.user_metadata,
        created_at: authUser.created_at
      });
      setIsLoading(true);

      // Supabaseでユーザー情報を取得
      console.log('🔍 getSupabaseUserを呼び出し...');
      let user = await getSupabaseUser(authUser.id);
      console.log('🔍 getSupabaseUser結果:', { 
        userFound: !!user, 
        userId: user?.id,
        stripe_customer_id: user?.stripe_customer_id,
        has_payment_method: user?.has_payment_method
      });

      if (!user) {
        // 初回ログイン - デフォルトでファンとして登録
        console.log('🆕 新規ユーザー検出 - registerUserを呼び出し');
        try {
          user = await registerUser(authUser);
          console.log('✅ registerUser成功:', {
            user_id: user.id,
            display_name: user.display_name,
            is_fan: user.is_fan,
            is_influencer: user.is_influencer
          });
        } catch (registerError) {
          console.error('❌ registerUser失敗:', registerError);
          throw registerError;
        }
      } else {
        console.log('✅ 既存ユーザー確認:', {
          user_id: user.id,
          display_name: user.display_name,
          is_fan: user.is_fan,
          is_influencer: user.is_influencer
        });
      }

      setSupabaseUser(user);

      // ユーザータイプを詳細にログ出力してデバッグ
      console.log('🔍 ユーザータイプ判定:', {
        is_influencer: user.is_influencer,
        is_fan: user.is_fan,
        user_id: user.id,
        auth_user_id: user.auth_user_id,
        display_name: user.display_name
      });

      // call_slotsテーブルから実際のユーザータイプを判定
      // インフルエンサーとしてcall_slotsを作成しているかチェック
      const { data: influencerSlots, error: influencerSlotsError } = await supabase
        .from('call_slots')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (influencerSlotsError) {
        console.error('❌ call_slots取得エラー（インフルエンサー）:', influencerSlotsError);
      }

      if (influencerSlots && influencerSlots.length > 0) {
        setUserType('influencer');
        console.log('👑 call_slotsからインフルエンサーとして設定:', { userId: user.id });
      } else {
        // ファンとしてcall_slotsを予約しているかチェック
        const { data: fanSlots, error: fanSlotsError } = await supabase
          .from('call_slots')
          .select('id')
          .eq('fan_user_id', user.id)
          .limit(1);

        if (fanSlotsError) {
          console.error('❌ call_slots取得エラー（ファン）:', fanSlotsError);
        }

        if (fanSlots && fanSlots.length > 0) {
          setUserType('fan');
          console.log('👤 call_slotsからファンとして設定:', { userId: user.id });
        } else {
          // call_slotsから判定できない場合、usersテーブルのフラグを使用
          if (user.is_influencer) {
            setUserType('influencer');
            console.log('👑 インフルエンサーとして設定 - is_influencer:', user.is_influencer);
          } else if (user.is_fan) {
            setUserType('fan');
            console.log('👤 ファンとして設定 - is_fan:', user.is_fan);
          } else {
            setUserType(null);
            console.log('⚠️ ユーザータイプが未設定 - is_influencer:', user.is_influencer, 'is_fan:', user.is_fan);
          }
        }
      }
    } catch (error) {
      console.error('❌ ユーザー同期エラー:', error);
      // エラー時はユーザー情報をクリア
      setSupabaseUser(null);
      setUserType(null);
    } finally {
      console.log('🏁 ユーザー同期完了');
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
        },
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const signInWithGoogle = async () => {
    try {
      // 環境に応じたリダイレクトURLを取得
      // 環境に応じたリダイレクトURLを取得
      const getRedirectUrl = () => {
        const origin = window.location?.origin;

        // originがundefinedの場合はデフォルト値を返す
        if (!origin) {
          console.warn('⚠️ window.location.origin が取得できませんでした');
          return 'https://oshi-talk.com'; // Production環境のデフォルト
        }

        // 本番環境（カスタムドメイン）
        if (origin === 'https://oshi-talk.com' || origin.includes('oshi-talk.com')) {
          return 'https://oshi-talk.com';
        }

        // Staging環境（カスタムドメイン）
        if (origin === 'https://staging.oshi-talk.com' || origin.includes('staging.oshi-talk.com')) {
          return 'https://staging.oshi-talk.com';
        }

        // Herokuドメイン（フォールバック）
        if (origin.includes && origin.includes('herokuapp.com')) {
          // 末尾のスラッシュを削除
          return origin.endsWith('/') ? origin.slice(0, -1) : origin;
        }

        // ローカル開発環境
        return 'http://localhost:5173';
      };

      const redirectUrl = getRedirectUrl();
      console.log('🔐 Google認証開始:', {
        redirectUrl,
        hostname: window.location.hostname,
        origin: window.location.origin
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            hd: '', // ドメイン制限（必要に応じて）
          },
          scopes: 'openid email profile',
        },
      });

      if (error) {
        console.error('❌ Google認証エラー:', error);
        throw error;
      }

      console.log('✅ Google認証リダイレクト開始:', data);
    } catch (error) {
      console.error('❌ Google認証処理エラー:', error);
      throw error;
    }
  };

  const switchToInfluencerMode = async () => {
    if (!user) throw new Error('ログインが必要です');

    try {
      const influencer = await switchToInfluencer(user);
      setSupabaseUser(influencer);
      setUserType('influencer');
    } catch (error) {
      console.error('インフルエンサー切り替えエラー:', error);
      throw error;
    }
  };

  const refreshUser = async () => {
    if (!user) return;
    await syncUser(user);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        supabaseUser,
        userType,
        isLoading,
        signIn,
        signUp,
        signOut,
        signInWithGoogle,
        switchToInfluencerMode,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}