/**
 * バックエンドAPIのURLを取得
 * 開発環境ではデフォルト値（http://localhost:3001）を使用
 * 本番環境では空文字列（相対パス）でも問題ない（同じドメインで動作するため）
 */
export const getBackendUrl = (): string => {
  const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
  const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';
  
  // 開発環境ではデフォルト値を使用
  const defaultBackendUrl = isDevelopment ? 'http://localhost:3001' : '';
  
  // 環境変数が設定されている場合はそれを使用、なければデフォルト値
  const backendUrl = import.meta.env.VITE_BACKEND_URL || defaultBackendUrl;
  
  // 本番環境で空文字列の場合は相対パスを使用（同じドメインで動作するため問題ない）
  if (!backendUrl && isDevelopment) {
    console.warn('⚠️ VITE_BACKEND_URLが設定されていません。開発環境ではバックエンドサーバーを起動してください。');
  }
  
  // 本番環境で空文字列の場合は相対パスとして使用（正常な動作）
  return backendUrl;
};

