# Migration管理ガイド

## 概要

Supabaseプロジェクトにおけるデータベースmigrationの作成・適用・管理手順を説明します。

## 環境構成

- **Dev環境**: `bpmarxvgryqhjfmqqdlg` - 開発・テスト用
- **Staging環境**: `wioealhsienyubwegvdu` - 本番前の最終テスト用
- **Production環境**: `atkhwwqunwmpzqkgavtx` - 本番環境

## Migration作成手順

### 1. Migrationファイルの作成

Supabase CLIを使用してmigrationファイルを作成：

```bash
# 新しいmigrationファイルを作成
supabase migration new [migration_name]

# 例: RLSポリシーの修正
supabase migration new fix_users_rls_policy
```

### 2. Migrationファイルの編集

作成されたmigrationファイルを編集：

```sql
-- 例: usersテーブルのRLSポリシー修正
-- supabase/migrations/[timestamp]_fix_users_rls_policy.sql

-- usersテーブルのRLSを有効化
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 既存ポリシーの削除
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

-- 新規ポリシーの作成
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = auth_user_id);
```

## Migration適用手順

### 方法1: MCP経由（推奨）

#### Staging環境への適用

```bash
# MCP環境をStagingに切り替え
./scripts/switch-mcp-env.sh staging

# Cursorを再起動（MCP設定反映のため）
# その後、MCP経由でmigrationを適用
```

#### Production環境への適用

```bash
# MCP環境をProductionに切り替え
./scripts/switch-mcp-env.sh production

# Cursorを再起動（MCP設定反映のため）
# その後、MCP経由でmigrationを適用
```

### 方法2: Supabase CLI経由

#### 環境ごとの適用

```bash
# Staging環境
cp supabase/config.staging.toml supabase/config.toml
SUPABASE_CONFIG_FILE=supabase/config.staging.toml supabase db push

# Production環境
cp supabase/config.production.toml supabase/config.toml
SUPABASE_CONFIG_FILE=supabase/config.production.toml supabase db push
```

## 確認手順

### Migration適用状況の確認

MCP経由で適用済みmigrationを確認：

```sql
-- 適用済みmigration一覧
SELECT version, name FROM supabase_migrations;
```

### RLSポリシーの確認

```sql
-- usersテーブルのRLSポリシー確認
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'users';
```

## ベストプラクティス

### 1. 環境順序の厳守

**必ず以下の順序で適用してください：**

1. **Dev環境** → 開発・テスト
2. **Staging環境** → 統合テスト
3. **Production環境** → 本番適用

### 2. Migrationの命名規則

```
[timestamp]_[description].sql

例:
20251126000000_fix_users_rls_policy.sql
20251127000000_add_user_profiles_table.sql
```

### 3. レビュープロセス

- Migration作成後は必ずコードレビュー
- Staging環境での動作確認
- Production適用前に影響範囲の最終確認

### 4. バックアップ

Production適用前に必ずバックアップを取得：

```bash
# バックアップの取得
supabase db dump > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 5. Rollback計画

Migration適用時は必ずrollback計画を準備：

- DDL変更の場合は注意深く確認
- データ移行を含む場合は事前バックアップ必須

## トラブルシューティング

### Migrationが適用されない場合

1. 環境設定の確認
   ```bash
   ./scripts/switch-mcp-env.sh [環境名]
   # Cursor再起動
   ```

2. Migrationファイルの構文確認
   ```bash
   supabase db diff --file [migration_file]
   ```

3. 適用状況の確認
   ```sql
   SELECT * FROM supabase_migrations ORDER BY version DESC LIMIT 5;
   ```

### RLSポリシーの問題

1. ポリシー確認
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'users';
   ```

2. テストクエリ
   ```sql
   -- ポリシーが正しく動作するかテスト
   SELECT * FROM users LIMIT 1; -- 認証済みの場合のみ成功
   ```

## 関連ドキュメント

- [Supabase CLI 環境別設定](./../supabase/CLI_USAGE.md)
- [複数環境設定](./../setup/MULTI_ENVIRONMENT_SETUP.md)
- [データベースマイグレーション](./../setup/DATABASE_MIGRATIONS.md)
