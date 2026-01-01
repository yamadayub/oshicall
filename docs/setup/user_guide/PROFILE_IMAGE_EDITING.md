# 📸 プロフィール画像編集機能

## ✅ 改善内容

### 以前

- 編集モードに入らないとカメラアイコンが表示されない
- 画像を選択後、「保存」ボタンを押す必要がある
- 2 ステップ操作が必要

### 改善後

- **カメラアイコンが常に表示**（編集モードに関係なく）
- **画像を選択すると自動的にアップロード・保存**
- 1 クリックで完了！

---

## 🎯 使い方

### ステップ 1: マイページにアクセス

```
http://localhost:5173/mypage
または
https://oshicall-2936440db16b.herokuapp.com/mypage
```

### ステップ 2: カメラアイコンをクリック

プロフィール画像の**右下にあるカメラボタン**をクリック

### ステップ 3: 画像を選択

- JPEG/PNG/WebP 対応
- 最大 5MB まで

### ステップ 4: 完了！

- 自動的にアップロード
- 即座に画像が更新される
- 成功メッセージが表示される

---

## 🎨 UI 改善

### カメラボタンのデザイン

- **常に表示**（編集モード不要）
- **大きく見やすい**デザイン
- **ホバー時にスケールアップ**アニメーション
- グラデーション背景（ピンク → 紫）

### エラーハンドリング

- ファイルサイズチェック（最大 5MB）
- ファイル形式チェック（JPEG/PNG/WebP）
- エラーメッセージは 3 秒後に自動消去

---

## 📂 ファイル保存先

### Supabase Storage

```
profile-images/{user_id}/{timestamp}_{filename}
```

### データベース更新

```sql
UPDATE users
SET profile_image_url = 'https://...supabase.co/storage/v1/object/public/profile-images/...'
WHERE id = {user_id};
```

---

## 🔧 技術詳細

### 関数

#### `handleImageChange` (自動保存)

```typescript
const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  // 1. ファイル取得
  // 2. バリデーション
  // 3. プレビュー生成
  // 4. Supabase Storageにアップロード
  // 5. DBのprofile_image_url更新
  // 6. ユーザー情報を再取得
  // 7. 成功メッセージ表示
};
```

#### バリデーション

- ファイルサイズ: 最大 5MB
- MIME type: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`

---

## 🚀 次のステップ（オプション）

1. **画像トリミング機能**

   - react-image-crop を使用
   - 正方形にクロップ

2. **画像圧縮**

   - browser-image-compression を使用
   - アップロード前に圧縮

3. **複数画像対応**
   - プロフィール画像ギャラリー
   - 背景画像の設定

---

✅ **プロフィール画像編集がワンクリックで完結するようになりました！**
