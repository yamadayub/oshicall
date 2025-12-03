// バックエンドAPIのベースURL
import { getBackendUrl } from '../lib/backend';
const API_BASE_URL = getBackendUrl();

// デバッグ情報を出力
console.log('🔍 API設定:', {
  VITE_BACKEND_URL: import.meta.env.VITE_BACKEND_URL,
  PROD: import.meta.env.PROD,
  API_BASE_URL: API_BASE_URL
});

// Stripe Customer作成
export const createStripeCustomer = async (
  email: string,
  name: string,
  authUserId: string
) => {
  const response = await fetch(`${API_BASE_URL}/api/stripe/create-customer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, authUserId }),
  });
  
  if (!response.ok) {
    throw new Error('Customer作成に失敗しました');
  }
  
  return response.json();
};

// SetupIntent作成（カード登録用）
export const createSetupIntent = async (customerId: string) => {
  const response = await fetch(`${API_BASE_URL}/api/stripe/create-setup-intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId }),
  });
  
  if (!response.ok) {
    throw new Error('SetupIntent作成に失敗しました');
  }
  
  return response.json();
};

// カード登録完了確認
export const confirmPaymentMethod = async (authUserId: string) => {
  const response = await fetch(`${API_BASE_URL}/api/stripe/confirm-payment-method`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authUserId }),
  });
  
  if (!response.ok) {
    throw new Error('カード登録確認に失敗しました');
  }
  
  return response.json();
};

// 与信確保（入札時）
export const authorizePayment = async (
  amount: number,
  customerId: string,
  auctionId: string
) => {
  const response = await fetch(`${API_BASE_URL}/api/stripe/authorize-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, customerId, auctionId }),
  });
  
  if (!response.ok) {
    throw new Error('与信確保に失敗しました');
  }
  
  return response.json();
};

// 与信キャンセル
export const cancelAuthorization = async (paymentIntentId: string) => {
  const response = await fetch(`${API_BASE_URL}/api/stripe/cancel-authorization`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentIntentId }),
  });
  
  if (!response.ok) {
    throw new Error('与信キャンセルに失敗しました');
  }
  
  return response.json();
};

// 決済確定（落札時）
export const capturePayment = async (
  paymentIntentId: string,
  auctionId: string
) => {
  const response = await fetch(`${API_BASE_URL}/api/stripe/capture-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentIntentId, auctionId }),
  });
  
  if (!response.ok) {
    throw new Error('決済確定に失敗しました');
  }
  
  return response.json();
};

// Stripe Connect Account作成（インフルエンサー用）
export const createConnectAccount = async (
  email: string,
  authUserId: string
) => {
  console.log('🔍 Connect Account作成開始:', {
    url: `${API_BASE_URL}/api/stripe/create-connect-account`,
    email,
    authUserId
  });
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/stripe/create-connect-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, authUserId }),
    });
    
    console.log('🔍 API応答:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API エラー:', errorText);
      throw new Error(`Connect Account作成に失敗しました: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('✅ API データ:', data);
    return data;
  } catch (error) {
    console.error('❌ API呼び出しエラー:', error);
    throw error;
  }
};

// インフルエンサーの Stripe アカウント状態を確認
export const getInfluencerStripeStatus = async (authUserId: string) => {
  console.log('🔍 API呼び出し開始:', {
    url: `${API_BASE_URL}/api/stripe/influencer-status`,
    authUserId
  });

  try {
    const response = await fetch(`${API_BASE_URL}/api/stripe/influencer-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authUserId }),
    });

    console.log('🔍 API応答:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API エラー:', errorText);
      throw new Error(`インフルエンサー状態の取得に失敗しました: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ API データ:', data);
    return data;
  } catch (error) {
    console.error('❌ API呼び出しエラー:', error);
    throw error;
  }
};

// インフルエンサーの売上データを取得
export const getInfluencerEarnings = async (authUserId: string) => {
  const response = await fetch(`${API_BASE_URL}/api/stripe/influencer-earnings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authUserId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`売上データ取得に失敗しました: ${errorText}`);
  }

  return response.json();
};

// Stripe Express Dashboardリンクを生成
export const createStripeDashboardLink = async (authUserId: string) => {
  const response = await fetch(`${API_BASE_URL}/api/stripe/create-login-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authUserId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Dashboardリンク生成に失敗しました: ${errorText}`);
  }

  return response.json();
};

// オンボーディング作成/再開
export const createOrResumeOnboarding = async (authUserId: string, email: string) => {
  const response = await fetch(`${API_BASE_URL}/api/stripe/create-or-resume-onboarding`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authUserId, email }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`オンボーディング作成に失敗しました: ${errorText}`);
  }

  return response.json();
};


