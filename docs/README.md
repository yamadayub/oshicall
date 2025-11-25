# OshiTalk ドキュメント

このディレクトリには、OshiTalkの要件定義書、機能仕様書、セットアップガイド、運用マニュアルが含まれています。

## 🤖 Claude Code 設定

- **[../.claude/project-context.md](../.claude/project-context.md)** - Claude Codeが常に参照するプロジェクト設定ファイル
  - プロジェクト概要、技術スタック、環境構成
  - 重要な実装パターン（高度な決済フロー、Stripe 2段階決済など）
  - よく使うコマンド、コーディング規約、注意事項

## 📋 ドキュメント一覧

### 全体要件
- **[REQUIREMENTS.md](./REQUIREMENTS.md)** - 全体の要件定義、サービス概要、技術スタック

### 機能仕様 (Functional Specifications)

#### コア機能
- **[auction.md](./functional/functions/auction.md)** - オークション機能（入札、即決購入、終了処理）
- **[talk.md](./functional/functions/talk.md)** - Talk（通話）機能（枠作成、予約、通話実施）
- **[payment.md](./functional/functions/payment.md)** - 決済・カード登録機能（Stripe連携、与信確保・決済確定）
- **[ADVANCED_PAYMENT_FLOW.md](./functional/ADVANCED_PAYMENT_FLOW.md)** - 高度な決済フロー（Webhook活用、Talk完了検証）の詳細仕様

#### ユーザー機能
- **[authentication.md](./functional/functions/authentication.md)** - ユーザー認証機能（Supabase Auth、メール認証、OAuth）
- **[influencer.md](./functional/functions/influencer.md)** - インフルエンサー管理機能（ダッシュボード、売上管理）
- **[follow.md](./functional/functions/follow.md)** - フォロー機能（フォロー/アンフォロー、優先表示）
- **[ranking.md](./functional/functions/ranking.md)** - ランキング機能（インフルエンサーランキング、人気Talk枠）

### セットアップ・運用 (Setup & Operations)

#### 環境構築
- **[PRODUCTION_SETUP.md](./deployment/PRODUCTION_SETUP.md)** - Production環境セットアップガイド（Heroku, Supabase, Stripe, Daily.co）
- **[DATABASE_MIGRATIONS.md](./setup/DATABASE_MIGRATIONS.md)** - データベースマイグレーション管理ガイド
- **[SUPABASE_CLI_AUTH.md](./setup/SUPABASE_CLI_AUTH.md)** - Supabase CLI認証設定
- **[MULTI_ENVIRONMENT_SETUP.md](./setup/MULTI_ENVIRONMENT_SETUP.md)** - 複数環境（Staging/Production）のセットアップ

#### 外部サービス連携
- **[STRIPE_SETUP_STEP_BY_STEP.md](./setup/STRIPE_SETUP_STEP_BY_STEP.md)** - Stripe Connect & 決済フロー詳細セットアップ
- **[RESEND_EMAIL_SETUP.md](./setup/RESEND_EMAIL_SETUP.md)** - Resendメール送信設定（任意アドレス送信対応）
- **[DAILY_WEBHOOK_SETUP.md](./setup/DAILY_WEBHOOK_SETUP.md)** - Daily.co Webhook設定
- **[SUPABASE_EDGE_FUNCTIONS_SETUP.md](./setup/SUPABASE_EDGE_FUNCTIONS_SETUP.md)** - Edge Functions デプロイガイド

### テスト・QA
- **[E2E_TEST_GUIDE.md](./test/E2E_TEST_GUIDE.md)** - E2Eテストガイド
- **[STAGING_E2E_TEST_GUIDE.md](./test/STAGING_E2E_TEST_GUIDE.md)** - ステージング環境テストガイド
- **[TEST_ACCOUNTS.md](./test/TEST_ACCOUNTS.md)** - テストアカウント情報
- **[TEST_CARD_REGISTRATION.md](./test/TEST_CARD_REGISTRATION.md)** - テストカード登録ガイド

### アーカイブ
- **[archive/](./archive/)** - 過去のドキュメントや完了報告書（参照専用）

## 🗂️ ドキュメント構成

各機能ドキュメントは以下の構成で記載されています：

1. **概要** - 機能の目的と概要
2. **機能詳細** - 具体的な機能とフロー
3. **データ構造** - DBテーブル定義、スキーマ
4. **UI/UX** - ユーザーインターフェース設計
5. **エラーハンドリング** - エラー処理とメッセージ
6. **セキュリティ** - セキュリティ対策とRLS設定
7. **パフォーマンス最適化** - 最適化手法
8. **将来実装予定** - 今後の拡張機能

## 🔍 クイックリファレンス

### 技術スタック

**フロントエンド**
- React 18 + TypeScript
- Vite
- TailwindCSS
- React Router

**バックエンド**
- Node.js / Express
- TypeScript
- Supabase (PostgreSQL)
- Stripe API
- Daily.co API

**インフラ**
- Heroku (本番・Staging環境)
- Supabase (DB・認証・ストレージ・Edge Functions)
- Cloudflare (DNS)

### 主要な実装ファイル

| 機能 | ファイルパス | 説明 |
|------|------------|------|
| **メインサーバー** | `backend/src/server.ts` | Expressサーバー設定、Stripe決済API、Buy Now処理 |
| **Talk機能** | `backend/src/routes/calls.ts` | Talk枠管理、予約処理 |
| **Daily Webhook** | `backend/src/routes/dailyWebhook.ts` | 通話イベント受信、ログ記録 |
| **決済判定** | `backend/src/services/paymentCapture.ts` | Talk完了判定、決済確定/キャンセルロジック |
| **インフルエンサー** | `backend/src/routes/influencerApplication.ts` | 審査申し込み処理 |

### データベース主要テーブル

| テーブル名 | 説明 | 詳細ドキュメント |
|-----------|------|----------------|
| `users` | ユーザー情報 | [authentication.md](./functional/functions/authentication.md) |
| `call_slots` | Talk枠 | [talk.md](./functional/functions/talk.md) |
| `auctions` | オークション | [auction.md](./functional/functions/auction.md) |
| `bids` | 入札履歴 | [auction.md](./functional/functions/auction.md) |
| `purchased_slots` | 購入済みTalk枠 | [talk.md](./functional/functions/talk.md) |
| `daily_call_events` | 通話イベントログ | [ADVANCED_PAYMENT_FLOW.md](./functional/ADVANCED_PAYMENT_FLOW.md) |
| `payment_transactions` | 決済履歴 | [payment.md](./functional/functions/payment.md) |

## 💡 ドキュメントの使い方

### 新機能開発時
1. 該当する機能ドキュメントを確認
2. データ構造とAPIを理解
3. 実装ファイルを参照
4. テストを実行

### バグ修正時
1. エラーハンドリングセクションを確認
2. 関連するデータ構造を確認
3. セキュリティ影響を検討

### レビュー時
1. 要件定義との整合性確認
2. データ構造の変更有無確認
3. セキュリティ対策の実装確認

## ❓ お問い合わせ

ドキュメントに関する質問や追加要望は、開発チームまでご連絡ください。
