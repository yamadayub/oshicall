# OshiTalk 開発環境セットアップガイド

## 🚀 ローカル開発環境の起動

### 前提条件

以下のアカウントと API キーが必要です：

1. **Supabase** - データベース
2. **Clerk** - 認証

### ステップ 1: 環境変数の設定

`.env.local`ファイルをプロジェクトルートに作成し、以下を設定：

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your-clerk-key

# Stripe Payment (オプション - 決済テスト時のみ必要)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-key

# Backend API URL (オプション - 決済テスト時のみ必要)
VITE_BACKEND_URL=http://localhost:3001
```

### ステップ 2: Supabase データベースの準備

Supabase Dashboard で以下のテーブルが作成されていることを確認：

- `influencers` - インフルエンサー情報
- `fans` - ファン情報
- `call_slots` - 通話枠
- `auctions` - オークション
- `bids` - 入札
- `purchased_slots` - 購入済み通話
- `reviews` - レビュー

### ステップ 3: 依存関係のインストール

```bash
npm install
```

### ステップ 4: 開発サーバーの起動

```bash
npm run dev
```

ブラウザで `http://localhost:5173` を開きます。

---

## 🔑 Clerk 認証のテスト

### ユーザー登録の流れ

1. 右上の「新規登録」ボタンをクリック
2. Clerk のモーダルが表示される
3. メールアドレスとパスワードを入力
4. 認証完了後、自動的に Supabase に`fans`テーブルにユーザーが作成される
5. 右上にユーザーアバターが表示される

### ユーザータイプの確認

- ログイン後、右上に「ファン」または「インフルエンサー」と表示される
- デフォルトは「ファン」として登録される
- Supabase Dashboard で直接`influencers`テーブルにユーザーを追加すると「インフルエンサー」になる

---

## 📊 データの動作確認

### モックデータでの動作確認

初期状態では、Supabase にデータがないため、モックデータが表示されます。

**表示されるもの：**

- ホーム画面に 10 件のトークセッション（モックデータ）
- 各トークカードに入札情報
- カウントダウンタイマー

### Supabase データでの動作確認

Supabase に実際のデータを追加すると、そのデータが表示されます：

```sql
-- 1. インフルエンサーを追加（Supabase SQL Editor）
INSERT INTO influencers (clerk_user_id, display_name, bio, profile_image_url)
VALUES ('clerk_user_id_here', 'テストインフルエンサー', 'テスト用', 'https://example.com/image.jpg');

-- 2. 通話枠を追加
INSERT INTO call_slots (
  influencer_id,
  title,
  description,
  scheduled_start_time,
  duration_minutes,
  starting_price,
  is_published
)
VALUES (
  'influencer_id_here',
  'テストトークセッション',
  'テスト用のセッションです',
  '2025-02-01 20:00:00+00',
  30,
  3000,
  true
);

-- 3. オークションを追加
INSERT INTO auctions (
  call_slot_id,
  status,
  start_time,
  end_time
)
VALUES (
  'call_slot_id_here',
  'active',
  NOW(),
  NOW() + INTERVAL '7 days'
);
```

---

## 🧪 機能のテスト

### 1. 認証機能

✅ **新規登録**

- 右上「新規登録」→ Clerk モーダル → メール・パスワード入力
- 成功: ユーザーアバターが表示される
- コンソールログ: "新規ユーザー - ファンとして登録します"

✅ **ログイン**

- 右上「ログイン」→ Clerk モーダル → ログイン
- 成功: ユーザーアバターが表示される

✅ **ログアウト**

- ユーザーアバターをクリック → "Sign out"
- 成功: ログイン/新規登録ボタンに戻る

### 2. オークション表示

✅ **オークション一覧**

- ホーム画面に表示される
- データソース: Supabase（データがない場合はモックデータ）

✅ **リアルタイム更新（実装済みだが未接続）**

- `subscribeToAuctionUpdates()`を使用して新しい入札をリアルタイム受信
- 現在はモックデータのため動作しない

### 3. データ取得の確認

ブラウザのコンソールで以下を確認：

```
✅ 成功: "Supabaseからデータを取得しました: [...]"
❌ データなし: "Supabaseにデータがないため、モックデータを使用します"
⚠️ エラー: "オークションデータの取得に失敗: ..."
```

---

## 🐛 トラブルシューティング

### Clerk エラー: "Publishable Key not found"

**解決方法:**

```bash
# .env.localを確認
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
```

再起動:

```bash
# サーバーを停止 (Ctrl+C)
npm run dev
```

### Supabase エラー: "Environment variables not set"

**解決方法:**

```bash
# .env.localを確認
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
```

### Clerk のモーダルが表示されない

**解決方法:**

1. ブラウザのコンソールでエラーを確認
2. Clerk Dashboard > API Keys で Publishable Key を確認
3. `.env.local`が正しく設定されているか確認
4. 開発サーバーを再起動

### データが表示されない

**原因:**

- Supabase にデータがない（正常）
- モックデータが表示される（正常）

**Supabase データを使いたい場合:**

1. Supabase Dashboard にログイン
2. SQL Editor で上記の INSERT 文を実行
3. ページをリロード

---

## 📝 次のステップ

### 実装済み ✅

1. ✅ Clerk 認証統合
2. ✅ Supabase 接続
3. ✅ オークション API
4. ✅ ファン API
5. ✅ インフルエンサー API
6. ✅ Stripe 決済 API（バックエンド）

### 未実装 🚧

1. 🚧 実際の入札機能
2. 🚧 リアルタイム入札更新の UI 連携
3. 🚧 Stripe 決済のフロントエンド統合
4. 🚧 ビデオ通話機能
5. 🚧 通知機能

---

## 🎯 現在の動作確認項目

最低限確認すべき項目：

- [ ] ユーザー登録ができる
- [ ] ログイン/ログアウトができる
- [ ] ホーム画面にトークセッション一覧が表示される
- [ ] ユーザータイプ（ファン）が表示される
- [ ] Supabase にユーザーが作成される（Supabase Dashboard で確認）

すべて ✅ なら、Clerk 統合は成功です！🎉

---

## 💡 ヒント

### Supabase Dashboard での確認

1. https://app.supabase.com/ にログイン
2. プロジェクトを選択
3. Table Editor > `fans` テーブル
4. ログインしたユーザーが追加されているか確認

### Clerk Dashboard での確認

1. https://dashboard.clerk.com/ にログイン
2. アプリケーションを選択
3. Users > 登録したユーザーが表示される
4. ユーザーの`id`が Supabase の`clerk_user_id`と一致する

---

## 🆘 サポート

問題が解決しない場合：

1. ブラウザのコンソールでエラーを確認
2. Supabase Dashboard > Logs でエラーを確認
3. `.env.local`ファイルを再確認
4. 開発サーバーを再起動

それでも解決しない場合は、エラーメッセージとスクリーンショットを共有してください。


