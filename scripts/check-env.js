// 環境変数チェックスクリプト
console.log('🔍 環境変数チェック開始...');

console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL || '❌ 未設定');
console.log('VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? '✅ 設定済み' : '❌ 未設定');
console.log('STRIPE_PUBLISHABLE_KEY:', process.env.STRIPE_PUBLISHABLE_KEY ? '✅ 設定済み' : '❌ 未設定');

if (!process.env.VITE_SUPABASE_URL) {
  console.error('❌ エラー: VITE_SUPABASE_URL が設定されていません');
  process.exit(1);
}

if (!process.env.VITE_SUPABASE_ANON_KEY) {
  console.error('❌ エラー: VITE_SUPABASE_ANON_KEY が設定されていません');
  process.exit(1);
}

console.log('✅ 環境変数チェック完了');

