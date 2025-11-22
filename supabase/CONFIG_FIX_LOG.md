# Supabase設定ファイル修正履歴

## 問題: 設定ファイルフォーマットエラー

作成した config.example.toml が古いフォーマットだったため、
Supabase CLI v2.x でパースエラーになった。

## 解決策: supabase init で正しいフォーマットを取得

1. supabase init --yes で新しい設定ファイルを生成
2. 生成された config.toml をテンプレートとして使用
3. 各環境用の設定ファイルを作成

## 現在の設定ファイル

- config.toml: supabase init で生成された正しいフォーマット
- config.staging.toml: Staging環境用（config.tomlのコピー）
- config.production.toml: Production環境用（プロジェクト情報設定済み）

## 使用方法

### Staging環境作業
cp supabase/config.staging.toml supabase/config.toml
supabase status

### Production環境作業
cp supabase/config.production.toml supabase/config.toml  
supabase status

## 注意点
- config.toml はGitignore推奨（環境固有の情報が入るため）
- 各環境ファイルにはプロジェクト固有の情報を設定

