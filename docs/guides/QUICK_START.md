# 🚀 クイックスタートガイド

モックデータを使ってすぐにアプリをテストできます！

## ⚡ 3 ステップで完了

### ステップ 1: データベースをリセット

Supabase Dashboard → SQL Editor で実行:

```sql
-- supabase_clean_reinstall.sql の内容を全てコピー&ペーストして実行
```

**結果:** 全てのテーブルがクリーンな状態で作成されます

### ステップ 2: モックデータを投入

**同じ SQL Editor で続けて実行:**

```sql
-- supabase_seed_mock_data.sql の内容を全てコピー&ペーストして実行
```

**結果:**

- ✅ インフルエンサー 10 人作成
- ✅ Talk 枠 10 件作成
- ✅ オークション 10 件作成（全て active 状態）

### ステップ 3: アプリで確認

```bash
# ブラウザで http://localhost:5174/ を開く（または再読み込み）
```

**期待される表示:**

- ✅ ホーム画面に 10 件の Talk 枠が表示される
- ✅ 各 Talk 枠に画像、タイトル、価格が表示される
- ✅ インフルエンサー名が表示される

## 🔍 動作確認

### ブラウザのコンソール（F12）で確認

```
📊 Supabaseから取得したデータ: [{...}, {...}, ...]
📊 取得件数: 10件
✅ 10件のTalk枠に変換しました
```

### Supabase で確認

```sql
-- active_auctions_view を確認
SELECT * FROM active_auctions_view;
```

**期待される結果:** 10 行のデータが返される

## ⚠️ 注意事項

### このスクリプトについて

- **テスト用データです** - 本番環境では使用しないでください
- **架空のユーザー** - auth.users に実際のユーザーは存在しません
- **認証は別** - 実際のログインユーザーとは独立しています

### 認証機能をテストする場合

1. 実際にログインする
2. Supabase SQL Editor で以下を実行:

```sql
-- 現在のログインユーザーをインフルエンサーに設定
UPDATE users
SET is_influencer = TRUE, is_verified = TRUE
WHERE auth_user_id = auth.uid();
```

3. ログアウト → ログイン
4. インフルエンサーダッシュボードで Talk 枠を作成

## 🔄 データをリセットする場合

```sql
-- ステップ1とステップ2を再度実行
-- または
DELETE FROM auctions;
DELETE FROM call_slots;
DELETE FROM users WHERE is_influencer = TRUE;
```

その後、`supabase_seed_mock_data.sql`を再実行

## 📸 画像について

### 現在の設定

- ローカル画像（`/public/images/`）を使用
- すぐに表示されます

### Supabase Storage に移行する場合

1. Storage → talk-images バケットを作成
2. `/public/images/talk_details/` の画像をアップロード
3. 以下の SQL で URL を更新:

```sql
-- Project REFを自分のものに変更
UPDATE call_slots
SET thumbnail_url = REPLACE(
  thumbnail_url,
  '/images/talk_details/',
  'https://[your-project].supabase.co/storage/v1/object/public/talk-images/'
);

UPDATE users
SET profile_image_url = REPLACE(
  profile_image_url,
  '/images/talks/',
  'https://[your-project].supabase.co/storage/v1/object/public/profile-images/'
)
WHERE is_influencer = TRUE;
```

## 🎯 完了後の状態

- ホーム画面: 10 件の Talk 枠が表示
- 各 Talk 枠: インフルエンサー情報、価格、入札額が表示
- オークション: 全て「開催中」状態

## 🐛 トラブルシューティング

### Talk 枠が表示されない

**確認 1:** ブラウザコンソールのログ

```
📊 取得件数: 0件  ← データベースが空
```

**対処:** `supabase_seed_mock_data.sql` を実行

**確認 2:** エラーメッセージ

```
❌ データ取得エラー: {...}
```

**対処:** エラー内容を確認して修正

### "relation does not exist" エラー

**原因:** テーブルまたはビューが存在しない

**対処:** `supabase_clean_reinstall.sql` を再実行

---

これでモックデータを使ったテストが簡単にできます！🎉
