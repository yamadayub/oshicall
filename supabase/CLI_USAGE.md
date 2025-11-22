# Supabase CLI 環境別設定の使い方

## 問題: --config フラグが認識されない

Supabase CLI v2.x では --config フラグは廃止されました。

## 正しい方法

### 方法1: 環境変数を使用
SUPABASE_CONFIG_FILE=config.production.toml supabase status

### 方法2: プロジェクトをリンク
supabase link --project-ref YOUR_PROJECT_ID

### 方法3: 設定ファイルを直接編集して使用
1. config.toml を config.production.toml で上書き
2. supabase status を実行
3. 元の設定に戻す

## 推奨ワークフロー

### Staging環境作業
cp supabase/config.staging.toml supabase/config.toml
supabase status
supabase db push

### Production環境作業  
cp supabase/config.production.toml supabase/config.toml
supabase status
supabase db push

### 設定ファイルの管理
- config.staging.toml: Staging環境用
- config.production.toml: Production環境用
- config.toml: 作業中の設定（Gitignore推奨）

