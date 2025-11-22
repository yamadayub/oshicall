# データベース移行完了ガイド 🎉

Mock データから Supabase データベースへの移行が完了しました！

## 📋 実施した変更

### 1. データベーススキーマ

- ✅ `fans`と`influencers`を統合 → `users`テーブル
- ✅ `is_fan`と`is_influencer`フラグで管理
- ✅ 全ての外部キー参照を更新

### 2. 画像ストレージ

- ✅ Supabase Storage を推奨
- ✅ `talk-images`と`profile-images`バケット
- ✅ 公開アクセス＋ RLS 設定

### 3. フロントエンド

- ✅ `Home.tsx`を DB 取得に変更
- ✅ `active_auctions_view`から取得
- ✅ フォールバック：データがない場合は Mock データ表示

## 🚀 セットアップ手順

### ステップ 1: データベースをクリーンインストール

```sql
-- Supabase SQL Editorで実行
-- supabase_clean_reinstall.sql の内容を全てコピー&ペースト
```

### ステップ 2: Storage をセットアップ（オプション）

#### A. Dashboard から（推奨）

```
1. Storage → New bucket
2. Name: talk-images, Public: ON
3. Name: profile-images, Public: ON
```

#### B. SQL から

```sql
-- supabase_storage_setup.sql を実行
```

### ステップ 3: 画像をアップロード（オプション）

```
Storage → talk-images → Upload file
public/images/talks/ の画像をアップロード
```

### ステップ 4: テストデータを投入

```sql
-- Supabase SQL Editorで実行（ログイン済みの状態で）
-- supabase_quick_test_data.sql を実行
```

これで以下が自動的に作成されます：

- ✅ あなたがインフルエンサーに設定される
- ✅ テスト用 Talk 枠が 1 つ作成される
- ✅ オークションが開始される

### ステップ 5: アプリで確認

```bash
npm run dev
```

ブラウザで http://localhost:5173 を開いて：

- ✅ ホーム画面に Talk 枠が表示される
- ✅ インフルエンサーダッシュボードにアクセスできる

## 📸 画像について

### 現状

- 画像は`public/images/`にあります
- 一時的にローカルパスを使用しています

### Supabase Storage に移行する場合

1. **画像をアップロード**

```
Storage → talk-images にアップロード
```

2. **URL を更新**

```sql
UPDATE call_slots
SET thumbnail_url = 'https://[your-project].supabase.co/storage/v1/object/public/talk-images/6.jpg'
WHERE user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid());

UPDATE users
SET profile_image_url = 'https://[your-project].supabase.co/storage/v1/object/public/profile-images/1.jpg'
WHERE auth_user_id = auth.uid();
```

### ローカル画像を使い続ける場合

- 特に変更は不要です
- `/public/images/`の画像がそのまま使われます

## 🎯 運営タスク

### インフルエンサーを承認する

```sql
-- メールアドレスで承認
UPDATE users
SET is_influencer = TRUE, is_verified = TRUE
WHERE auth_user_id = (
  SELECT id FROM auth.users WHERE email = 'user@example.com'
);
```

### Talk 枠を確認する

```sql
SELECT
  cs.title,
  u.display_name as インフルエンサー名,
  cs.scheduled_start_time as Talk開始,
  a.status as オークション状態,
  a.total_bids_count as 入札数
FROM call_slots cs
JOIN users u ON cs.user_id = u.id
LEFT JOIN auctions a ON cs.id = a.call_slot_id
WHERE cs.is_published = TRUE
ORDER BY cs.scheduled_start_time;
```

## 📚 参考ドキュメント

- **STORAGE_SETUP_GUIDE.md** - 画像ストレージの詳細設定
- **ADMIN_GUIDE.md** - 運営管理コマンド集
- **supabase_quick_test_data.sql** - クイックテストデータ投入

## 🐛 トラブルシューティング

### Talk 枠が表示されない

**原因**: データベースにデータがない

**対処**:

```sql
-- supabase_quick_test_data.sql を実行
```

### 画像が表示されない（404 エラー）

**原因**: Storage に画像がない、または URL が間違っている

**対処**:

1. ローカル画像を使用: `/images/talks/6.jpg`
2. または Storage にアップロード後 URL を更新

### インフルエンサーモードに切り替えられない

**原因**: `is_influencer`フラグが`FALSE`

**対処**:

```sql
UPDATE users
SET is_influencer = TRUE
WHERE auth_user_id = auth.uid();
```

### "User not found"エラー

**原因**: ログインしていない、または users テーブルにレコードがない

**対処**:

1. ログアウト → ログイン（users レコードが自動作成される）
2. 再度テストデータ投入スクリプトを実行

## ✅ 完了チェックリスト

- [ ] `supabase_clean_reinstall.sql`を実行した
- [ ] ログイン → ログアウト → ログインした（users レコード作成）
- [ ] `supabase_quick_test_data.sql`を実行した
- [ ] アプリで Talk 枠が表示されることを確認した
- [ ] インフルエンサーダッシュボードにアクセスできた
- [ ] Talk 枠を作成できた

## 🎊 次のステップ

1. **本番データの投入** - 実際のインフルエンサーと Talk 枠を追加
2. **画像の最適化** - Supabase Storage への完全移行
3. **入札機能の実装** - ファンが入札できるようにする
4. **決済機能の実装** - Stripe との連携

---

おめでとうございます！Mock データから Supabase への移行が完了しました！🚀
