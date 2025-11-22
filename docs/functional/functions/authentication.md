# ユーザー認証機能 要件定義

## 概要
Supabase Authを使用したユーザー認証システム。メール認証とGoogle OAuth認証をサポート。

## 認証方式

### 1. メール認証
**実装ファイル**: `src/components/AuthModal.tsx`, `src/lib/auth.ts`

**サインアップフロー**:
1. メールアドレス・パスワード入力
2. Supabase Auth `signUp` 呼び出し
3. 確認メール送信
4. ユーザーがメールリンクをクリック
5. メールアドレス確認完了
6. ログイン状態へ

**ログインフロー**:
1. メールアドレス・パスワード入力
2. Supabase Auth `signInWithPassword` 呼び出し
3. 認証成功
4. セッション確立

**API**:
```typescript
// サインアップ
const { data, error } = await supabase.auth.signUp({
  email: email,
  password: password,
});

// ログイン
const { data, error } = await supabase.auth.signInWithPassword({
  email: email,
  password: password,
});
```

### 2. Google OAuth認証
**実装ファイル**: `src/lib/auth.ts`

**フロー**:
1. 「Googleでログイン」ボタンクリック
2. Googleログイン画面へリダイレクト
3. ユーザーがGoogleアカウントで認証
4. コールバックURLへリダイレクト
5. 自動ログイン

**API**:
```typescript
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`
  }
});
```

## セッション管理

### AuthContext
**実装ファイル**: `src/contexts/AuthContext.tsx`

**提供する値**:
- `user` - Supabase Auth User（メールなど）
- `supabaseUser` - Supabase users テーブルのユーザー情報
- `loading` - 認証状態読み込み中フラグ
- `refreshUser` - ユーザー情報再取得関数

**初期化**:
```typescript
useEffect(() => {
  // セッション確認
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) {
      fetchUserFromSupabase(session.user.id);
    }
  });

  // 認証状態変更リスナー
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      if (session?.user) {
        fetchUserFromSupabase(session.user.id);
      } else {
        setUser(null);
        setSupabaseUser(null);
      }
    }
  );

  return () => subscription.unsubscribe();
}, []);
```

### ユーザー情報取得
**DB操作**:
```typescript
const fetchUserFromSupabase = async (userId: string) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (data) {
    setSupabaseUser(data);
  }
};
```

## ログアウト

**実装**:
```typescript
const handleSignOut = async () => {
  await supabase.auth.signOut();
  navigate('/');
};
```

**処理内容**:
1. Supabase セッション削除
2. ローカル状態クリア
3. トップページへリダイレクト

## プロフィール管理

### ユーザープロフィール更新
**実装ファイル**: `src/pages/MyPage.tsx` (Profileタブ)

**更新可能項目**:
- `display_name` - 表示名
- `bio` - 自己紹介
- `profile_image_url` - プロフィール画像

**フロー**:
1. プロフィール編集フォーム入力
2. 画像アップロード（Supabase Storage）
3. `users`テーブル更新

**API**:
```typescript
// 画像アップロード
const { data: uploadData, error: uploadError } = await supabase.storage
  .from('avatars')
  .upload(`${userId}/${fileName}`, file);

// プロフィール更新
const { error } = await supabase
  .from('users')
  .update({
    display_name: displayName,
    bio: bio,
    profile_image_url: imageUrl
  })
  .eq('id', userId);
```

## データ構造

### users テーブル
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  bio TEXT,
  profile_image_url TEXT,
  stripe_customer_id TEXT UNIQUE,
  has_payment_method BOOLEAN DEFAULT FALSE,
  total_calls_completed INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## UI/UX

### 認証モーダル
**コンポーネント**: `src/components/AuthModal.tsx`

**タブ**:
- ログイン
- サインアップ

**入力フィールド**:
- メールアドレス
- パスワード

**ボタン**:
- メールでログイン / サインアップ
- Googleでログイン

**表示タイミング**:
- 未ログインユーザーが入札しようとした時
- ヘッダーの「ログイン」ボタンクリック時

### プロフィールページ
**ページ**: `src/pages/MyPage.tsx` (Profileタブ)

**表示内容**:
- プロフィール画像
- 表示名
- 自己紹介
- メールアドレス（読み取り専用）
- 登録日

## エラーハンドリング

### サインアップエラー
- メール重複: `このメールアドレスは既に登録されています`
- パスワード弱い: `パスワードは6文字以上で設定してください`
- ネットワークエラー: `通信エラーが発生しました`

### ログインエラー
- 認証情報不正: `メールアドレスまたはパスワードが正しくありません`
- メール未確認: `メールアドレスの確認が完了していません`

### OAuth エラー
- Google認証キャンセル: モーダル表示継続
- 権限拒否: エラーメッセージ表示

## セキュリティ

### パスワードポリシー
- 最小長: 6文字
- Supabase Authのデフォルトポリシー使用

### セッション
- JWTトークン使用
- 有効期限: 1時間（自動更新）
- HttpOnly Cookie（将来実装）

### 権限
- RLS (Row Level Security) 使用
- ユーザーは自分のデータのみ更新可能

```sql
-- RLS ポリシー例
CREATE POLICY "Users can update own profile"
ON users
FOR UPDATE
USING (auth.uid() = id);
```

## 認証フロー図

```
未認証ユーザー
  ↓
入札ボタンクリック
  ↓
認証モーダル表示
  ↓
メール認証 or Google OAuth
  ↓
認証成功
  ↓
users テーブルにユーザー作成（初回のみ）
  ↓
カード登録モーダル表示（has_payment_method=falseの場合）
  ↓
カード登録完了
  ↓
入札処理へ
```
