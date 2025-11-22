# Supabase Production環境設定

## 目的
このファイルはProduction環境用のSupabase設定です。
Staging環境とProduction環境で異なるSupabaseプロジェクトを使用するために必要です。

## 作成手順
1. supabase config.example.toml をコピー
2. Productionプロジェクトの情報を設定
3. supabase --config config.production.toml status で確認

## 設定内容
- project_id: ProductionプロジェクトのID
- api_url: ProductionプロジェクトのAPI URL  
- db_url: ProductionプロジェクトのDB URL
- anon_key: Productionプロジェクトの匿名キー
- service_role_key: Productionプロジェクトのサービスロールキー

## 使用方法
supabase --config config.production.toml [command]

