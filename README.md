# 推しトーク (OshiTalk)

推しとつながる、あなただけの時間 - インフルエンサーとのオンライントークアプリ

## 概要

推しトーク は、アイドルファンが推しのアイドルとオンラインでトークできるアプリケーションです。オークション形式で入札し、最高価格を入札した人が推しとの特別な時間を楽しむことができます。

## 機能

- 🏠 **ホームページ**: 現在開催中のトークセッション一覧
- 💬 **トーク詳細**: 推しの情報とオークション参加
- 🎥 **ライブトーク**: リアルタイムでの推しとの会話
- 🏆 **ランキング**: 推しの人気ランキング表示
- 👤 **マイページ**: プロフィール、実績、コレクション管理
- 📊 **入札履歴**: 過去の入札履歴確認

## 技術スタック

### フロントエンド

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **State Management**: Zustand + React Context API
- **Date Utilities**: date-fns

### バックエンド・サービス

- **Authentication**: Supabase Auth (Google OAuth)
- **Database**: Supabase (PostgreSQL)
- **Payment**: Stripe (Connect for influencers)
- **Video Calls**: Daily.co
- **Email**: Resend

詳細は [`docs/TECH_STACK.md`](./docs/TECH_STACK.md) を参照してください。

## 開発環境セットアップ

### ステップ 1: リポジトリのクローンと依存関係のインストール

```bash
# リポジトリをクローン
git clone https://github.com/yamadayub/oshicall.git
cd oshicall

# 依存関係をインストール
npm install
```

### ステップ 2: 環境変数の設定

プロジェクトルートに `.env` ファイルを作成し、以下の環境変数を設定してください：

```bash
# Supabase Configuration
# プロジェクトURL: https://app.supabase.com/project/[your-project-id]/settings/api
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Stripe Payment
# Dashboard: https://dashboard.stripe.com/
VITE_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
```

**各サービスの API キーの取得方法:**

1. **Supabase**:

   - [Supabase](https://supabase.com/)でアカウント作成
   - プロジェクト作成後、Settings > API から URL と anon key を取得
   - SQL Editor で `supabase_schema.sql` を実行してデータベースをセットアップ

2. **Stripe**:
   - [Stripe](https://stripe.com/)でアカウント作成
   - Dashboard > Developers > API keys から Publishable Key を取得

詳細なセットアップ手順は以下をご覧ください：
- Database: [`docs/setup/SUPABASE_SETUP.md`](./docs/setup/SUPABASE_SETUP.md)
- Payment: [`docs/setup/STRIPE_SETUP_STEP_BY_STEP.md`](./docs/setup/STRIPE_SETUP_STEP_BY_STEP.md)
- Email: [`docs/setup/RESEND_SETUP.md`](./docs/setup/RESEND_SETUP.md)
- Video: [`docs/guides/DAILY_SETUP_GUIDE.md`](./docs/guides/DAILY_SETUP_GUIDE.md)

### ステップ 3: 開発サーバーの起動

```bash
# 開発サーバーを起動
npm run dev
```

ブラウザで `http://localhost:5173` を開いてアプリケーションを確認できます。

## デプロイ

本番環境は Heroku にデプロイされています。詳細は [`docs/setup/UNIFIED_DEPLOYMENT.md`](./docs/setup/UNIFIED_DEPLOYMENT.md) を参照してください。

```bash
# Heroku CLIでログイン
heroku login

# デプロイ
git push heroku main
```

## ドキュメント

### 🤖 Claude Code 設定
- **[.claude/project-context.md](./.claude/project-context.md)** - Claude Codeが常に参照するプロジェクト設定ファイル
  - プロジェクト概要、技術スタック、環境構成
  - 重要な実装パターン、コーディング規約
  - よく使うコマンド、注意事項

### セットアップガイド
- [Supabase セットアップ](./docs/setup/SUPABASE_SETUP.md)
- [Stripe セットアップ](./docs/setup/STRIPE_SETUP_STEP_BY_STEP.md)
- [統合デプロイメント](./docs/setup/UNIFIED_DEPLOYMENT.md)
- [マルチ環境セットアップ](./docs/setup/MULTI_ENVIRONMENT_SETUP.md)
- **[データベースマイグレーション管理](./docs/setup/DATABASE_MIGRATIONS.md)** ⭐ 重要
- **[マイグレーション運用戦略](./docs/setup/MIGRATION_STRATEGY.md)** - 今後の運用方針
- [Supabase CLI 認証](./docs/setup/SUPABASE_CLI_AUTH.md) - `supabase login` vs 環境変数

### 機能ガイド
- [管理者ガイド](./docs/guides/ADMIN_GUIDE.md)
- [オークション確定ガイド](./docs/guides/AUCTION_FINALIZATION_GUIDE.md)
- [インフルエンサー管理](./docs/guides/INFLUENCER_MANAGEMENT.md)
- [Daily.co セットアップ](./docs/guides/DAILY_SETUP_GUIDE.md)

### 機能別要件定義
- [機能ドキュメント一覧](./docs/functions/) - オークション、Talk、決済、認証など各機能の詳細仕様

### テスト
- [テストガイド](./docs/test/) - E2Eテスト、テストアカウント、テストカード情報

### 開発リファレンス
- [開発ガイド](./docs/DEVELOPMENT.md)
- [クイックスタート](./docs/QUICK_START.md)
- [技術スタック](./docs/TECH_STACK.md)
- [次のステップ](./docs/NEXT_STEPS.md)

### データベース管理
- **現在のマイグレーション**: `supabase/migrations/` (Supabase CLI管理)
- レガシーSQL: `sql/` ([詳細](./sql/README.md))
  - `sql/migrations/` - 過去のマイグレーション（参照用）
  - `sql/fixes/` - バグ修正スクリプト（参照用）
  - `sql/tests/` - テスト・検証スクリプト（参照用）

## ライセンス

MIT License
