-- ============================================
-- usersテーブルのRLSポリシー修正
-- 認証済みユーザーが自分のレコードを作成・更新・参照できるようにする
-- ============================================

-- usersテーブルのRLSを確実に有効化
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーがあれば削除（重複エラー防止）
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

-- 1. SELECT: 自分のプロフィールは参照可能
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = auth_user_id);

-- 2. UPDATE: 自分のプロフィールは更新可能
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = auth_user_id);

-- 3. INSERT: 自分のプロフィールは作成可能（これが不足していたため新規登録が失敗していた）
CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = auth_user_id);

-- 4. 公開プロフィール（インフルエンサーなど）の参照ポリシーは既存のものを維持するか、必要に応じて追加
-- 注: 既存の "Influencers can view fans from their call slots" 等はそのまま機能します
