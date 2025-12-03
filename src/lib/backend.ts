/**
 * バックエンドAPIのURLを取得
 * 開発環境ではデフォルト値（http://localhost:3001）を使用
 * 本番環境では環境変数VITE_BACKEND_URLが必須
 */
export const getBackendUrl = (): string => {
  const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
  const defaultBackendUrl = isDevelopment ? 'http://localhost:3001' : '';
  const backendUrl = import.meta.env.VITE_BACKEND_URL || defaultBackendUrl;
  
  if (!backendUrl) {
    console.warn('⚠️ VITE_BACKEND_URLが設定されていません。開発環境ではバックエンドサーバーを起動してください。');
  }
  
  return backendUrl;
};

