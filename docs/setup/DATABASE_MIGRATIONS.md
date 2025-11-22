# データベースマイグレーション管理ガイド

Supabase CLIを使用したデータベーススキーマのバージョン管理とマイグレーション管理の完全ガイドです。

**最終更新**: 2025年11月22日
**対象環境**: Staging (`wioealhsienyubwegvdu`) / Production (`atkhwwqunwmpzqkgavtx`)

---

## 目次

- [環境構成](#環境構成)
- [初期セットアップ](#初期セットアップ)
- [環境間のスキーマ同期](#環境間のスキーマ同期)
- [日常的なマイグレーション管理](#日常的なマイグレーション管理)
- [ベストプラクティス](#ベストプラクティス)
- [トラブルシューティング](#トラブルシューティング)

---

## 環境構成

### プロジェクト一覧

| 環境 | Project Ref | 用途 | URL |
|------|-------------|------|-----|
| **Staging** | `wioealhsienyubwegvdu` | 開発・テスト環境 | https://supabase.com/dashboard/project/wioealhsienyubwegvdu |
| **Production** | `atkhwwqunwmpzqkgavtx` | 本番環境 | https://supabase.com/dashboard/project/atkhwwqunwmpzqkgavtx |

### マイグレーション管理の原則

```
開発フロー:
1. Staging環境で開発・テスト
2. Gitにコミット（マイグレーションファイル）
3. Production環境に適用
```

---

## 初期セットアップ

### ステップ1: Supabase CLIのインストール確認

```bash
# バージョン確認
npx supabase --version

# 期待される出力: 2.58.5 以上
```

### ステップ2: Supabaseアカウント認証

```bash
# ブラウザで自動認証（推奨）
npx supabase login

# 成功すると "You are now logged in" と表示される
```

**認証トークンの保存場所**:
- macOS: システムKeychain
- Linux: `~/.config/supabase/`
- Windows: OS資格情報マネージャー

**利点**:
- ✅ トークンを自動管理（コピペ不要）
- ✅ セキュア
- ✅ 継続的に使用可能
- ✅ 有効期限の自動管理

### ステップ3: プロジェクト一覧の確認

```bash
# アクセストークンを使用してプロジェクト一覧を取得
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase projects list

# 出力例:
#   LINKED | ORG ID | REFERENCE ID         | NAME                | REGION
#     ●    | ...    | wioealhsienyubwegvdu | oshicall-staging    | Tokyo
#          | ...    | atkhwwqunwmpzqkgavtx | oshicall-production | Tokyo
```

### ステップ4: プロジェクトにリンク

```bash
# Staging環境にリンク
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase link --project-ref wioealhsienyubwegvdu

# または Production環境にリンク
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase link --project-ref atkhwwqunwmpzqkgavtx
```

---

## 環境間のスキーマ同期

### シナリオ: Staging → Production への初期スキーマ移行

新しいProduction環境を作成した際、Staging環境の既存スキーマをProductionに反映する手順です。

#### ステップ1: Staging環境からスキーマ情報を取得

Supabase DashboardのSQL Editorで以下のクエリを実行します。

**1-1. テーブル構造の取得**

```sql
SELECT
    'CREATE TABLE IF NOT EXISTS ' ||
    schemaname || '.' || tablename || ' (' ||
    string_agg(
        column_name || ' ' || data_type ||
        CASE
            WHEN character_maximum_length IS NOT NULL
            THEN '(' || character_maximum_length || ')'
            ELSE ''
        END ||
        CASE
            WHEN is_nullable = 'NO' THEN ' NOT NULL'
            ELSE ''
        END,
        ', '
    ) || ');'
FROM pg_tables t
JOIN information_schema.columns c
    ON c.table_schema = t.schemaname
    AND c.table_name = t.tablename
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;
```

**1-2. ENUM型の定義取得**

```sql
SELECT
    n.nspname AS schema,
    t.typname AS enum_name,
    string_agg(e.enumlabel, ''', ''' ORDER BY e.enumsortorder) AS enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public'
GROUP BY n.nspname, t.typname
ORDER BY t.typname;
```

**1-3. PRIMARY KEY/FOREIGN KEYの取得**

```sql
SELECT
    tc.table_name,
    tc.constraint_type,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
    AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE')
ORDER BY tc.table_name, tc.constraint_type, kcu.ordinal_position;
```

**1-4. DEFAULT値とNOT NULL制約の取得**

```sql
SELECT
    table_name,
    column_name,
    column_default,
    is_nullable,
    data_type,
    udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
    AND (column_default IS NOT NULL OR is_nullable = 'NO')
ORDER BY table_name, ordinal_position;
```

**1-5. インデックスの取得**

```sql
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

#### ステップ2: 初期マイグレーションファイルの作成

取得した情報を基に、初期マイグレーションファイルを作成します。

```bash
# タイムスタンプ生成
TIMESTAMP=$(date +%Y%m%d%H%M%S)

# マイグレーションファイル作成
cat > supabase/migrations/${TIMESTAMP}_initial_schema.sql << 'EOF'
-- ============================================
-- 初期スキーマ作成マイグレーション
-- Staging環境から取得したスキーマをProduction環境に適用
-- ============================================

-- ============================================
-- ENUM型の作成
-- ============================================

CREATE TYPE auction_status AS ENUM ('draft', 'scheduled', 'active', 'ended', 'cancelled');
CREATE TYPE call_slot_status AS ENUM ('planned', 'live', 'completed');
CREATE TYPE call_status AS ENUM ('pending', 'ready', 'in_progress', 'completed', 'cancelled', 'no_show');
CREATE TYPE daily_event_type AS ENUM ('participant-joined', 'participant-left', 'room-ended', 'meeting-ended');
CREATE TYPE payment_status AS ENUM ('pending', 'authorized', 'captured', 'failed', 'refunded');
CREATE TYPE user_type AS ENUM ('influencer', 'fan');

-- ============================================
-- テーブルの作成（依存関係の順序）
-- ============================================

-- usersテーブル
CREATE TABLE users (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    auth_user_id uuid NOT NULL,
    display_name character varying(100) NOT NULL,
    bio text,
    profile_image_url text,
    -- ... その他のカラム定義
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- ... その他のテーブル定義

-- ============================================
-- PRIMARY KEY制約の追加
-- ============================================

ALTER TABLE ONLY users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
-- ... その他の制約

-- ============================================
-- FOREIGN KEY制約の追加
-- ============================================

ALTER TABLE ONLY call_slots ADD CONSTRAINT call_slots_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
-- ... その他の外部キー制約

-- ============================================
-- インデックスの作成
-- ============================================

CREATE INDEX idx_users_auth_user ON users USING btree (auth_user_id);
-- ... その他のインデックス

EOF
```

#### ステップ3: Production環境にリンク

```bash
# Production環境にリンク
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase link --project-ref atkhwwqunwmpzqkgavtx
```

#### ステップ4: マイグレーションの適用

```bash
# 適用予定のマイグレーションを確認
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase db push --linked

# プロンプトで確認メッセージが表示されたら "Y" を入力
```

**重要な注意点**:
- マイグレーションファイルのタイムスタンプは、最も古い日付にする必要があります
- 既存のマイグレーションファイルよりも古いタイムスタンプを設定してください
- 例: 既存ファイルが `20251113003634_*.sql` なら、初期スキーマは `20251113000000_initial_schema.sql` にする

#### ステップ5: 適用結果の検証

```bash
# マイグレーション履歴を確認
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase migration list --linked

# 出力例:
#   Local          | Remote         | Time (UTC)
#  ----------------|----------------|---------------------
#   20251113000000 | 20251113000000 | 2025-11-13 00:00:00
#   20251113003634 | 20251113003634 | 2025-11-13 00:36:34
```

Supabase Dashboardでも確認:
1. Table Editorでテーブルが作成されているか確認
2. Database → Migrations でマイグレーション履歴を確認

---

## 日常的なマイグレーション管理

### パターン1: 新しい機能のマイグレーション作成

最も一般的なワークフロー：

```bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. Staging環境で開発
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Staging環境にリンク
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase link --project-ref wioealhsienyubwegvdu

# マイグレーションファイルを作成
npx supabase migration new add_feature_name

# 生成されたファイルを編集
# 例: 新しいテーブル追加
cat > supabase/migrations/$(ls -t supabase/migrations/*.sql | head -1) << 'EOF'
-- Add notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Add RLS policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);
EOF

# Staging環境に適用
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase db push --linked

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. Gitにコミット
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

git add supabase/migrations/
git commit -m "Add notifications table"
git push origin main

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. Production環境に適用
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Production環境にリンク
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase link --project-ref atkhwwqunwmpzqkgavtx

# マイグレーション一覧を確認
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase migration list --linked

# Production環境に適用
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase db push --linked
```

### パターン2: Dashboardで変更した内容を記録

Supabase Dashboardで試行錯誤した後、確定したスキーマをマイグレーションとして記録：

```bash
# 1. Supabase Dashboardで変更（テーブル追加、カラム変更など）

# 2. 差分を確認してマイグレーションを生成
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase db diff --linked --schema public > supabase/migrations/$(date +%Y%m%d%H%M%S)_dashboard_changes.sql

# 3. 生成されたファイルを確認・編集
code supabase/migrations/$(ls -t supabase/migrations/*.sql | head -1)

# 4. コミット（既に本番に反映済みなので push不要）
git add supabase/migrations/
git commit -m "Record dashboard schema changes"
git push origin main
```

---

## ベストプラクティス

### ✅ DO

#### 1. 小さく頻繁にマイグレーション

```bash
# ✅ GOOD: 1つのマイグレーション = 1つの機能変更
20251102120000_add_notifications_table.sql
20251102130000_add_user_preferences_table.sql
20251102140000_update_users_rls_policies.sql

# ❌ BAD: 1つのマイグレーションで大量の変更
20251102_big_update.sql  # 10個のテーブル変更
```

#### 2. わかりやすいファイル名

```bash
# ✅ GOOD
20251102120000_add_user_email_column.sql
20251102130000_create_notifications_table.sql
20251102140000_fix_follows_rls_policy.sql

# ❌ BAD
20251102120000_update.sql
20251102130000_fix.sql
```

#### 3. 冪等性を保つ

```sql
-- ❌ BAD: 2回実行するとエラー
ALTER TABLE users ADD COLUMN email TEXT;
CREATE INDEX idx_users_email ON users(email);

-- ✅ GOOD: 何回実行しても安全
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

#### 4. コメントを残す

```sql
-- Migration: Add email notification feature
-- Ticket: OSHI-123
-- Author: @yamadayub
-- Date: 2024-11-02
--
-- 説明:
-- ユーザーにメール通知を送るための機能を追加
-- notifications テーブルとRLSポリシーを作成

ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

#### 5. RLSポリシーを忘れずに

```sql
-- テーブル作成
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ✅ IMPORTANT: RLSを有効化
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ✅ IMPORTANT: ポリシーを作成
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);
```

### ❌ DON'T

#### 1. 本番DBで直接変更しない

```bash
# ❌ BAD: Supabase Dashboardで直接本番DBを変更
# → マイグレーション履歴に記録されない

# ✅ GOOD: Dashboardで変更 → supabase db diff で記録
npx supabase db diff --schema public > migration.sql
git commit && git push
```

#### 2. コミット済みマイグレーションを変更しない

```bash
# ❌ BAD: 既にコミット済みのマイグレーションを編集
code supabase/migrations/20251101_add_users.sql

# ✅ GOOD: 新しいマイグレーションで修正
npx supabase migration new fix_users_table
```

#### 3. データ削除を含む変更は慎重に

```sql
-- ⚠️ DANGER: データが失われる
ALTER TABLE users DROP COLUMN email;

-- ✅ BETTER: まずバックアップ
-- 1. Supabase Dashboardでテーブルをエクスポート
-- 2. Staging環境でテスト
-- 3. Production環境に適用
```

---

## 環境の切り替え

### 現在リンク中の環境を確認

```bash
# 現在リンクしているプロジェクトを確認
cat supabase/.temp/project-ref

# 出力例: wioealhsienyubwegvdu (Staging)
# または: atkhwwqunwmpzqkgavtx (Production)
```

### 環境切り替えコマンド

```bash
# Staging環境に切り替え
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase link --project-ref wioealhsienyubwegvdu

# Production環境に切り替え
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase link --project-ref atkhwwqunwmpzqkgavtx
```

### エイリアス設定（推奨）

```bash
# ~/.zshrc または ~/.bashrc に追加
alias sb-staging='SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase link --project-ref wioealhsienyubwegvdu'
alias sb-prod='SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase link --project-ref atkhwwqunwmpzqkgavtx'

# 使い方
sb-staging  # Staging環境にリンク
sb-prod     # Production環境にリンク
```

---

## トラブルシューティング

### エラー: "Access token not provided"

```bash
# 原因: 認証されていない
# 解決策1: supabase login を実行
npx supabase login

# 解決策2: 環境変数を設定
export SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6"
```

### エラー: "file name must match pattern"

```bash
# 原因: ファイル名が命名規則に従っていない
# 解決策: 正しい形式で作成
npx supabase migration new feature_name
# → 20251102123456_feature_name.sql が生成される
```

### マイグレーションが失敗した場合

```bash
# 1. エラーメッセージを確認
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase db push --linked

# 2. マイグレーションファイルを修正
code supabase/migrations/latest.sql

# 3. 再試行
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase db push --linked
```

### ローカルとリモートの差分を確認

```bash
# 差分を表示
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase db diff --linked --schema public

# 差分をマイグレーションファイルとして保存
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase db diff --linked --schema public > supabase/migrations/$(date +%Y%m%d%H%M%S)_sync.sql
```

### Production環境への適用漏れを確認

```bash
# 1. Production環境にリンク
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase link --project-ref atkhwwqunwmpzqkgavtx

# 2. マイグレーション一覧を確認
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase migration list --linked

# Local にあって Remote にないマイグレーションを確認

# 3. 適用
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase db push --linked
```

---

## よくある質問

### Q: HerokuにSUPABASE_ACCESS_TOKENを設定する必要は？

**A**: ❌ 不要です。

理由:
```
開発者のMac
  ↓ 1. マイグレーション作成
  ↓ 2. supabase db push（本番DBに直接適用）
  ↓ 3. git push
  ↓
Heroku
  ↓ 4. コードをデプロイ（DBは既に最新）
  └─ 5. アプリを実行
```

Herokuはアプリを実行するだけで、マイグレーションは実行しません。

### Q: マイグレーションのロールバックは？

**A**: ⚠️ 手動で対応します。

```bash
# 1. 新しいマイグレーションでロールバックSQLを実行
npx supabase migration new rollback_feature_name

# 2. ロールバックSQLを記述
cat > supabase/migrations/latest.sql << 'EOF'
-- Rollback: Remove notifications table
DROP TABLE IF EXISTS notifications;
EOF

# 3. 適用
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase db push --linked
```

---

## まとめ

### 日常的なワークフロー

```bash
# 1. Staging環境でマイグレーション作成
sb-staging  # エイリアスを使用
npx supabase migration new feature_name

# 2. SQLを記述
code supabase/migrations/latest.sql

# 3. Staging環境に適用
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase db push --linked

# 4. Gitにコミット
git add supabase/migrations/
git commit -m "Add feature"
git push origin main

# 5. Production環境に適用
sb-prod  # エイリアスを使用
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase db push --linked
```

### 重要なルール

- ✅ すべてのスキーマ変更はマイグレーションファイル経由
- ✅ Staging環境でテストしてからProduction環境に適用
- ✅ マイグレーションは必ずGitにコミット
- ✅ 冪等性を保つ（何回実行しても安全）
- ❌ コミット済みマイグレーションは変更しない
- ❌ Production環境で直接変更しない

---

## 参考リンク

- [Supabase CLI - Database Migrations](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [Supabase CLI - Managing Environments](https://supabase.com/docs/guides/cli/managing-environments)
- [Database Schema - Best Practices](https://supabase.com/docs/guides/database/overview)
- [マイグレーション運用戦略](./MIGRATION_STRATEGY.md)
- [プロジェクト内マイグレーション履歴](../../supabase/migrations/README.md)
