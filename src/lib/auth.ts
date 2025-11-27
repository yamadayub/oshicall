import { User as AuthUser } from '@supabase/supabase-js';
import { supabase, type User } from './supabase';

// ユーザータイプを判定
export const getUserType = async (authUserId: string): Promise<'influencer' | 'fan' | null> => {
  const { data: user } = await supabase
    .from('users')
    .select('is_fan, is_influencer')
    .eq('auth_user_id', authUserId)
    .single();
  
  if (!user) return null;
  
  // インフルエンサー優先（両方trueの場合）
  if (user.is_influencer) return 'influencer';
  if (user.is_fan) return 'fan';
  
  return null;
};

// ユーザーをインフルエンサーに更新
export const updateToInfluencer = async (
  authUser: AuthUser
): Promise<User> => {
  const { data, error } = await supabase
    .from('users')
    .update({
      is_influencer: true,
    })
    .eq('auth_user_id', authUser.id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// 新規ユーザーを登録（デフォルトはファン）
export const registerUser = async (
  authUser: AuthUser
): Promise<User> => {
  console.log('🆕 registerUser関数開始:', {
    authUserId: authUser.id,
    email: authUser.email,
    metadata: authUser.user_metadata
  });

  const displayName = authUser.user_metadata?.display_name ||
                     authUser.user_metadata?.full_name ||
                     authUser.email?.split('@')[0] ||
                     'Unnamed User';

  const profileImageUrl = authUser.user_metadata?.avatar_url ||
                        authUser.user_metadata?.picture ||
                        null;

  console.log('📝 計算された登録データ:', {
    displayName,
    profileImageUrl,
    email: authUser.email
  });

  const insertData = {
    auth_user_id: authUser.id,
    display_name: displayName,
    profile_image_url: profileImageUrl,
    is_fan: true,
    is_influencer: false,
  };

  console.log('📝 SupabaseにINSERT実行:', insertData);

  const { data, error } = await supabase
    .from('users')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('❌ Supabase INSERTエラー:', {
      error,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    });
    throw error;
  }

  console.log('✅ Supabase INSERT成功:', {
    returnedData: data,
    id: data.id,
    is_fan: data.is_fan,
    is_influencer: data.is_influencer,
    display_name: data.display_name,
    auth_user_id: data.auth_user_id
  });
  return data;
};

// call_slotsテーブルからユーザータイプを判定
const determineUserTypeFromCallSlots = async (
  userId: string
): Promise<'influencer' | 'fan' | null> => {
  // インフルエンサーとしてcall_slotsを作成しているかチェック
  const { data: influencerSlots } = await supabase
    .from('call_slots')
    .select('id')
    .eq('user_id', userId)
    .limit(1);
  
  if (influencerSlots && influencerSlots.length > 0) {
    console.log('👑 call_slotsからインフルエンサーとして判定:', { userId });
    return 'influencer';
  }
  
  // ファンとしてcall_slotsを予約しているかチェック
  const { data: fanSlots } = await supabase
    .from('call_slots')
    .select('id')
    .eq('fan_user_id', userId)
    .limit(1);
  
  if (fanSlots && fanSlots.length > 0) {
    console.log('👤 call_slotsからファンとして判定:', { userId });
    return 'fan';
  }
  
  return null;
};

// Supabaseユーザー情報を取得
// authUserId: auth.users.id (認証ユーザーID)
// 戻り値: usersテーブルのレコード（users.idとusers.auth_user_idを含む）
export const getSupabaseUser = async (
  authUserId: string
): Promise<User | null> => {
  console.log('🔍 [getSupabaseUser] 検索開始:', {
    '検索キー': 'auth_user_id',
    '検索値 (auth.users.id)': authUserId,
    '理由': 'Supabase Authのsession.user.idはauth.users.idなので、usersテーブルのauth_user_idカラムで検索する必要がある',
  });
  
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('auth_user_id', authUserId)
    .single();
  
  if (error) {
    console.log('❌ [getSupabaseUser] usersテーブルにユーザーが見つかりません:', {
      'エラー': error.message,
      '検索したauth_user_id': authUserId,
    });
    return null;
  }
  
  console.log('✅ [getSupabaseUser] usersテーブルからユーザー情報を取得:', {
    'users.id (主キー、call_slots.user_idで使用)': data.id,
    'users.auth_user_id (auth.users.idと一致)': data.auth_user_id,
    '表示名': data.display_name,
    'is_fan': data.is_fan,
    'is_influencer': data.is_influencer,
    '作成日時': data.created_at,
    '説明': 'call_slotsテーブルなどではusers.idを使用するが、認証情報から取得する場合はauth_user_idで検索する必要がある',
  });
  
  // call_slotsテーブルから実際のユーザータイプを判定
  // call_slotsテーブルではusers.idを使用しているため、data.id（users.id）で検索
  console.log('🔍 [getSupabaseUser] call_slotsテーブルからユーザータイプを判定:', {
    '使用するID': 'users.id',
    'users.idの値': data.id,
    '理由': 'call_slots.user_idとcall_slots.fan_user_idはusers.idを参照しているため',
  });
  
  const actualUserType = await determineUserTypeFromCallSlots(data.id);
  
  if (actualUserType) {
    // call_slotsから判定できた場合、usersテーブルのフラグを更新
    const updateData: { is_fan?: boolean; is_influencer?: boolean } = {};
    
    if (actualUserType === 'influencer') {
      updateData.is_influencer = true;
      updateData.is_fan = false;
    } else {
      updateData.is_fan = true;
      updateData.is_influencer = false;
    }
    
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', data.id) // users.idで更新
      .select()
      .single();
    
    if (!updateError && updatedUser) {
      console.log('✅ [getSupabaseUser] ユーザータイプをcall_slotsから更新:', {
        'users.id': data.id,
        '判定されたタイプ': actualUserType,
        '更新後のデータ': updatedUser
      });
      return updatedUser;
    }
  }
  
  return data;
};

// ファンからインフルエンサーに切り替え
export const switchToInfluencer = async (
  authUser: AuthUser
): Promise<User> => {
  // 現在のユーザー情報を取得
  const user = await getSupabaseUser(authUser.id);
  
  if (!user) {
    throw new Error('ユーザー情報が見つかりません');
  }
  
  // 既にインフルエンサーの場合はそのまま返す
  if (user.is_influencer) {
    return user;
  }
  
  // 承認チェック（is_influencerフラグが運営によって立てられている必要がある）
  // 注: 運営がSQLで is_influencer = TRUE を設定済みであること
  throw new Error('インフルエンサー権限がありません。運営の承認が必要です。');
};


