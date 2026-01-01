# Google 認証画面のサービス名修正ガイド

## 問題

Google 認証画面で Supabase の Project ID が表示されている

## 解決方法

### 1. Supabase ダッシュボードでの設定変更

### Authentication 設定の変更

1. **Supabase ダッシュボード**にログイン
2. **Authentication** → **Settings** に移動
3. **Site URL** セクションで以下を設定：
   - **Site URL**: `https://oshicall-2936440db16b.herokuapp.com`
   - **Redirect URLs**: `https://oshicall-2936440db16b.herokuapp.com/**`

### Google OAuth 設定の変更

1. **Authentication** → **Providers** → **Google** に移動
2. **Site URL** を設定：
   - **Site URL**: `https://oshicall-2936440db16b.herokuapp.com`

### 2. Google Cloud Console での設定変更

#### OAuth 同意画面の設定

1. **Google Cloud Console** にアクセス
2. **APIs & Services** → **OAuth consent screen** に移動
3. **App information** セクションで以下を設定：
   - **App name**: `OshiTalk`
   - **User support email**: 適切なメールアドレス
   - **App logo**: OshiTalk のロゴ画像（オプション）

#### 承認済みドメインの設定

1. **Authorized domains** セクションで以下を追加：
   - `oshicall-2936440db16b.herokuapp.com`
   - `herokuapp.com`（必要に応じて）

### 3. アプリケーション側での設定

#### 環境変数の確認

```bash
# Herokuの環境変数を確認
heroku config:get VITE_SUPABASE_URL
heroku config:get VITE_SUPABASE_ANON_KEY
```

#### リダイレクト URL の確認

現在の設定：

```typescript
// src/contexts/AuthContext.tsx
const getRedirectUrl = () => {
  if (window.location.hostname.includes("herokuapp.com")) {
    return `${window.location.origin}/`;
  }
  return window.location.origin;
};
```

### 4. 設定変更後の確認

#### テスト手順

1. **ブラウザのキャッシュをクリア**
2. **プライベートブラウジングモード**でアクセス
3. **Google 認証を試行**
4. **認証画面で「OshiTalk」が表示されることを確認**

#### 確認項目

- [ ] 認証画面で「OshiTalk」が表示される
- [ ] Project ID ではなくサービス名が表示される
- [ ] ロゴが表示される（設定した場合）
- [ ] 認証フローが正常に動作する

### 5. トラブルシューティング

#### 設定が反映されない場合

1. **ブラウザキャッシュをクリア**
2. **Supabase の設定を再確認**
3. **Google Cloud Console の設定を再確認**
4. **数分待ってから再試行**（設定反映に時間がかかる場合がある）

#### エラーが発生する場合

1. **Supabase のログを確認**
2. **Google Cloud Console のログを確認**
3. **ブラウザの開発者ツールでエラーを確認**

## 注意事項

- 設定変更後は反映に数分かかる場合があります
- 本番環境での変更は慎重に行ってください
- テスト用アカウントで事前に確認することを推奨します
