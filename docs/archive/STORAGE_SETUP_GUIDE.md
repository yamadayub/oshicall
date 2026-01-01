# Supabase Storage セットアップガイド

## 📸 画像ストレージの設定

### ステップ 1: Storage バケットの作成

#### A. Supabase Dashboard から作成（推奨）

```
1. Supabase Dashboard にログイン
2. 左サイドバーの「Storage」をクリック
3. 「New bucket」をクリック
4. 以下の設定でバケットを作成:

バケット1: talk-images
- Name: talk-images
- Public bucket: ON（チェック）
- File size limit: 5 MB
- Allowed MIME types: image/jpeg, image/png, image/webp

バケット2: profile-images
- Name: profile-images
- Public bucket: ON（チェック）
- File size limit: 2 MB
- Allowed MIME types: image/jpeg, image/png, image/webp
```

#### B. SQL から作成（代替方法）

```sql
-- supabase_storage_setup.sql を実行
```

### ステップ 2: 既存画像のアップロード

#### 方法 1: Supabase Dashboard から手動アップロード

```
1. Storage → talk-images バケットを開く
2. 「Upload file」をクリック
3. public/images/talks/ の画像を選択してアップロード
   - 1.jpg
   - 2.jpg
   - 3.jpg
   - ...
   - 10.jpg

4. Storage → profile-images バケットを開く
5. 同様に画像をアップロード
```

#### 方法 2: Supabase CLI を使用（自動化）

```bash
# Supabase CLIをインストール
npm install -g supabase

# プロジェクトにログイン
supabase link --project-ref [your-project-ref]

# 画像を一括アップロード
supabase storage cp public/images/talks/*.jpg supabase://talk-images/
supabase storage cp public/images/talks/*.png supabase://talk-images/
```

### ステップ 3: 画像 URL の取得

アップロード後、画像 URL は以下の形式になります:

```
https://[project-ref].supabase.co/storage/v1/object/public/talk-images/1.jpg
https://[project-ref].supabase.co/storage/v1/object/public/talk-images/2.jpg
...
```

**Project Ref の確認方法:**

```
Supabase Dashboard → Settings → API → Project URL
例: https://abcdefghijklmnop.supabase.co
```

### ステップ 4: データベースへの投入

画像 URL を取得したら、ユーザーデータと Talk 枠データを投入します。

#### A. インフルエンサーユーザーの作成

```sql
-- 1. Supabase Authでユーザーを作成（または既存ユーザーを使用）
-- 2. そのユーザーをインフルエンサーに設定

UPDATE users
SET
  is_influencer = TRUE,
  is_verified = TRUE,
  display_name = 'あいり',
  bio = '今日もお喋りしましょうね〜✨',
  profile_image_url = 'https://[your-project].supabase.co/storage/v1/object/public/profile-images/1.jpg',
  total_earnings = 185000,
  total_calls_completed = 15,
  average_rating = 4.8
WHERE auth_user_id = (
  SELECT id FROM auth.users WHERE email = 'your-email@example.com'
);
```

#### B. Talk 枠の作成

```sql
-- user_idを自分のユーザーIDに置き換え
INSERT INTO call_slots (
  user_id,
  title,
  description,
  scheduled_start_time,
  duration_minutes,
  starting_price,
  minimum_bid_increment,
  is_published,
  thumbnail_url
) VALUES
(
  '[your-user-id]',
  'みんなで元気チャージ☀️',
  '疲れた心を癒やします♪悩み相談や愚痴聞きもOK！一緒に笑顔になりましょう〜',
  '2025-10-15 18:00:00+09',
  30,
  3000,
  100,
  true,
  'https://[your-project].supabase.co/storage/v1/object/public/talk-images/6.jpg'
)
RETURNING id;
```

#### C. オークションの作成

```sql
-- call_slot_idを上で取得したIDに置き換え
INSERT INTO auctions (
  call_slot_id,
  status,
  start_time,
  end_time
) VALUES
(
  '[call-slot-id]',
  'active',
  NOW(),
  '2025-10-14 18:00:00+09'
);
```

### ステップ 5: 画像 URL の一括置換スクリプト

既存の画像パスを Supabase Storage URL に変換するヘルパー:

```typescript
// scripts/convert-image-urls.ts
const PROJECT_REF = "your-project-ref";
const BASE_URL = `https://${PROJECT_REF}.supabase.co/storage/v1/object/public`;

function convertImageUrl(localPath: string): string {
  // '/images/talks/1.jpg' -> 'https://xxx.supabase.co/storage/v1/object/public/talk-images/1.jpg'
  if (localPath.startsWith("/images/talks/")) {
    const filename = localPath.replace("/images/talks/", "");
    return `${BASE_URL}/talk-images/${filename}`;
  }

  if (localPath.startsWith("/images/talk_details/")) {
    const filename = localPath.replace("/images/talk_details/", "");
    return `${BASE_URL}/talk-images/details/${filename}`;
  }

  return localPath;
}

// 使用例
const oldUrl = "/images/talks/1.jpg";
const newUrl = convertImageUrl(oldUrl);
console.log(newUrl);
// https://your-project.supabase.co/storage/v1/object/public/talk-images/1.jpg
```

## 📝 完全なデータ投入スクリプト例

```sql
-- Project REFを変更してください
DO $$
DECLARE
  v_project_ref TEXT := 'your-project-ref';
  v_base_url TEXT := 'https://' || v_project_ref || '.supabase.co/storage/v1/object/public';
  v_user_id UUID;
  v_slot_id UUID;
BEGIN
  -- 現在のユーザーを取得
  SELECT id INTO v_user_id FROM users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  -- インフルエンサーに設定
  UPDATE users
  SET
    is_influencer = TRUE,
    is_verified = TRUE,
    profile_image_url = v_base_url || '/profile-images/1.jpg'
  WHERE id = v_user_id;

  -- Talk枠を作成
  INSERT INTO call_slots (
    user_id,
    title,
    description,
    scheduled_start_time,
    duration_minutes,
    starting_price,
    minimum_bid_increment,
    is_published,
    thumbnail_url
  ) VALUES
  (
    v_user_id,
    'みんなで元気チャージ☀️',
    '疲れた心を癒やします♪',
    NOW() + INTERVAL '2 days',
    30,
    3000,
    100,
    true,
    v_base_url || '/talk-images/6.jpg'
  )
  RETURNING id INTO v_slot_id;

  -- オークションを作成
  INSERT INTO auctions (
    call_slot_id,
    status,
    start_time,
    end_time
  ) VALUES
  (
    v_slot_id,
    'active',
    NOW(),
    NOW() + INTERVAL '1 day 23 hours'
  );

  RAISE NOTICE 'Talk枠とオークションを作成しました: %', v_slot_id;
END $$;
```

## 🔍 動作確認

### 1. Storage の確認

```
Supabase Dashboard → Storage → talk-images
画像が表示されることを確認
```

### 2. データベースの確認

```sql
SELECT
  cs.title,
  cs.thumbnail_url,
  u.display_name,
  u.profile_image_url,
  a.status
FROM call_slots cs
JOIN users u ON cs.user_id = u.id
LEFT JOIN auctions a ON cs.id = a.call_slot_id
WHERE cs.is_published = TRUE;
```

### 3. アプリケーションの確認

```bash
npm run dev
```

ブラウザで http://localhost:5173 を開いて、Talk 枠が表示されることを確認。

## 🆘 トラブルシューティング

### 画像が表示されない

1. バケットが public になっているか確認
2. RLS ポリシーが設定されているか確認
3. 画像 URL が正しいか確認（ブラウザで直接開いてみる）

### アップロードできない

1. ファイルサイズ制限を確認
2. MIME type が許可されているか確認
3. RLS ポリシーで INSERT が許可されているか確認

### URL が 404 エラー

1. Project REF が正しいか確認
2. バケット名とファイル名が正しいか確認
3. ファイルが実際にアップロードされているか確認

---

このガイドに従って、Supabase Storage のセットアップと既存画像の移行を完了してください！
