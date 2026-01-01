# フォロー機能セットアップ - トラブルシューティング

## エラー: "policy already exists"

### 問題

```
ERROR: 42710: policy "Anyone can view follows" for table "follows" already exists
```

このエラーは、既にポリシーが存在している状態で同じポリシーを作成しようとした場合に発生します。

### 原因

1. マイグレーションスクリプトを複数回実行した
2. 以前に部分的にマイグレーションが実行されていた
3. 手動でポリシーを作成していた

### 解決方法

#### 方法1: ポリシーのみを修正（推奨・最速）

既にテーブルが作成されていて、ポリシーのみにエラーがある場合:

```bash
# Supabase SQLエディタで以下のファイルを実行
supabase/migrations/fix_follows_policies_only.sql
```

このスクリプトは：
- ✅ 既存のポリシーを削除
- ✅ 新しいポリシーを作成
- ✅ データは保持される

#### 方法2: 完全に再作成

すべてをクリーンな状態から再作成したい場合:

```bash
# Supabase SQLエディタで以下のファイルを実行
supabase/migrations/create_follows_table_fixed.sql
```

このスクリプトは：
- ✅ 既存のポリシー、ビュー、関数を削除
- ✅ テーブル、インデックスを再作成（既存のデータは保持）
- ✅ すべての関連オブジェクトを再作成

⚠️ **注意**: フォローデータは保持されますが、実行前にバックアップを推奨

#### 方法3: 段階的に確認して修正

現在の状態を確認してから対処したい場合:

**ステップ1: 現在の状態を確認**

```sql
-- Supabase SQLエディタで実行
-- check_and_fix_follows.sql の上部の確認クエリを実行
```

これで以下を確認できます：
- テーブルの存在
- ポリシーの一覧
- インデックスの一覧
- 関数とビューの存在

**ステップ2: 必要な部分だけ修正**

確認結果に基づいて、`check_and_fix_follows.sql` のコメントアウトされた部分から必要なものを実行

## エラー: "relation already exists"

### 問題

```
ERROR: relation "follows" already exists
```

### 解決方法

1. `CREATE TABLE IF NOT EXISTS` を使用（既に含まれています）
2. または完全削除して再作成:

```sql
-- ⚠️ 警告: 既存のフォローデータがすべて削除されます
DROP TABLE IF EXISTS follows CASCADE;

-- その後、create_follows_table_fixed.sql を実行
```

## エラー: "function already exists"

### 問題

```
ERROR: function get_follow_counts(uuid) already exists
```

### 解決方法

`CREATE OR REPLACE FUNCTION` を使用（既に含まれています）

## エラー: "column does not exist"

### 問題

```
ERROR: column "auth_user_id" does not exist
```

### 原因

follower_id または following_id が users テーブルの正しいカラムを参照していない

### 解決方法

1. users テーブルの構造を確認:

```sql
\d users
-- または
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;
```

2. 必要に応じて外部キー参照を修正

## 実行後の確認方法

### 1. テーブルが正しく作成されたか確認

```sql
-- テーブルの構造確認
\d follows

-- または詳細表示
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'follows'
ORDER BY ordinal_position;
```

### 2. ポリシーが正しく作成されたか確認

```sql
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'follows'
ORDER BY policyname;
```

期待される結果:
- `Anyone can view follows` (SELECT)
- `Users can follow others` (INSERT)
- `Users can unfollow` (DELETE)

### 3. インデックスが作成されたか確認

```sql
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'follows'
ORDER BY indexname;
```

期待される結果:
- `follows_pkey` (PRIMARY KEY)
- `idx_follows_follower_id`
- `idx_follows_following_id`
- `idx_follows_created_at`

### 4. 関数が作成されたか確認

```sql
SELECT
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('get_follow_counts', 'is_following')
ORDER BY routine_name;
```

### 5. ビューが作成されたか確認

```sql
SELECT
  table_name
FROM information_schema.views
WHERE table_schema = 'public'
AND table_name IN ('user_followers', 'user_following')
ORDER BY table_name;
```

### 6. 動作テスト

```sql
-- テストデータの挿入（既存のユーザーIDを使用）
-- 注意: 実際のユーザーIDに置き換えてください
INSERT INTO follows (follower_id, following_id)
VALUES (
  'your-fan-user-id',
  'your-influencer-user-id'
);

-- フォロー情報の確認
SELECT * FROM follows LIMIT 5;

-- フォロー数の確認
SELECT * FROM get_follow_counts('your-user-id');

-- フォロー状態の確認
SELECT is_following('your-fan-user-id', 'your-influencer-user-id');

-- ビューの確認
SELECT * FROM user_followers LIMIT 5;
SELECT * FROM user_following LIMIT 5;

-- テストデータの削除
DELETE FROM follows
WHERE follower_id = 'your-fan-user-id'
AND following_id = 'your-influencer-user-id';
```

## 推奨される実行順序

### 初回セットアップ

1. ✅ `create_follows_table_fixed.sql` を実行
2. ✅ 確認クエリで検証
3. ✅ 動作テストを実行

### エラーが出た場合

1. ✅ エラーメッセージを確認
2. ✅ `check_and_fix_follows.sql` で現在の状態を確認
3. ✅ 必要に応じて `fix_follows_policies_only.sql` を実行
4. ✅ 再度確認クエリで検証

## よくある質問

### Q: 既存のフォローデータは保持されますか？

A: はい、`DROP TABLE` を実行しない限り、既存のフォローデータは保持されます。ポリシー、ビュー、関数の再作成はデータに影響しません。

### Q: マイグレーションを何度も実行しても大丈夫ですか？

A: `create_follows_table_fixed.sql` と `fix_follows_policies_only.sql` は冪等性があり、何度実行しても安全です。

### Q: RLSポリシーは正しく動作していますか？

A: 以下のクエリで確認できます:

```sql
-- ログインユーザーとしてフォロー情報を閲覧（成功するはず）
SELECT * FROM follows LIMIT 5;

-- 他のユーザーのフォローを作成（失敗するはず）
INSERT INTO follows (follower_id, following_id)
VALUES ('other-user-id', 'some-influencer-id');
-- エラー: new row violates row-level security policy
```

### Q: パフォーマンスは最適化されていますか？

A: はい、以下のインデックスが作成されています:
- `follower_id` でのフィルタリングが高速
- `following_id` でのフィルタリングが高速
- `created_at` での並び替えが高速

## サポート

問題が解決しない場合:
1. Supabaseのログを確認
2. ブラウザのコンソールでエラーを確認
3. プロジェクトのIssueトラッカーで報告
