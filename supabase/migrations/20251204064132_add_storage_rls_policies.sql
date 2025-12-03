-- =========================================
-- Storage RLSポリシーの設定
-- =========================================
-- Talk枠作成時の画像アップロードエラーを修正
-- エラー: "new row violates row-level security policy"
-- =========================================

-- ステップ1: バケットの作成（存在しない場合）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('talk-images', 'talk-images', true, 5242880, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']::text[]),
  ('profile-images', 'profile-images', true, 2097152, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']::text[])
ON CONFLICT (id) DO NOTHING;

-- ステップ2: 既存のポリシーを削除（重複を防ぐ）
-- 注意: storage.objectsテーブルのRLSは通常既に有効になっています
DROP POLICY IF EXISTS "Public Access for talk images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload talk images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own talk images" ON storage.objects;
DROP POLICY IF EXISTS "Public Access for profile images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile images" ON storage.objects;

-- ステップ4: talk-images バケットのポリシー
-- 1. 誰でも画像を閲覧可能
CREATE POLICY "Public Access for talk images"
ON storage.objects FOR SELECT
USING (bucket_id = 'talk-images');

-- 2. 認証済みユーザーがアップロード可能
CREATE POLICY "Authenticated users can upload talk images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'talk-images' 
  AND auth.role() = 'authenticated'
);

-- 3. 自分がアップロードした画像は削除可能
CREATE POLICY "Users can delete their own talk images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'talk-images' 
  AND auth.uid() = owner
);

-- ステップ5: profile-images バケットのポリシー
-- 1. 誰でも画像を閲覧可能
CREATE POLICY "Public Access for profile images"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-images');

-- 2. 認証済みユーザーがアップロード可能
CREATE POLICY "Authenticated users can upload profile images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profile-images' 
  AND auth.role() = 'authenticated'
);

-- 3. 自分がアップロードした画像は削除可能
CREATE POLICY "Users can delete their own profile images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'profile-images' 
  AND auth.uid() = owner
);

