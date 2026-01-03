# OshiTalk ドキュメント

このディレクトリには、OshiTalkの業務仕様、機能仕様、セットアップガイド、運用マニュアルが含まれています。

## 📁 ディレクトリ構成

```
docs/
├── business/                    # 業務仕様（原本）
│   ├── README.md                # 業務仕様一覧・概要
│   ├── auction.md               # オークション業務
│   ├── video-call.md            # ビデオ通話業務
│   ├── payment.md               # 決済業務
│   ├── user-management.md       # ユーザー管理業務
│   └── glossary.md              # 用語集
│
├── functional/                  # 機能仕様（実装方針）
│   ├── README.md                # 機能仕様一覧
│   ├── auction.md               # オークション機能
│   ├── talk.md                  # Talk機能
│   ├── payment.md               # 決済機能
│   ├── authentication.md        # 認証機能
│   ├── influencer.md            # インフルエンサー管理機能
│   ├── follow.md                # フォロー機能
│   ├── ranking.md               # ランキング機能
│   ├── call-status-management.md # 通話ステータス管理
│   └── [その他技術仕様]
│
├── test/                        # テスト関連
│   ├── plans/                   # テスト計画書
│   │   └── [機能名]_TEST_PLAN.md
│   ├── E2E_TEST_GUIDE.md        # E2Eテストガイド
│   └── TEST_ACCOUNTS.md         # テストアカウント情報
│
├── setup/                       # セットアップガイド
│   ├── troubleshooting/         # トラブルシューティング
│   └── user_guide/              # ユーザーガイド
│
├── archive/                     # 過去のドキュメント（参照専用）
│
└── ai_workflow/                 # AI開発プロセス
    ├── AI_TDD_DEVELOPMENT_GUIDE.md  # AI-TDD開発ガイド（統合版）
    └── CODE_CHANGE_WORKFLOW.md   # コード変更ワークフロー
```

## 📋 ドキュメント一覧

### 業務仕様（/docs/business/）

**目的**: ビジネス要件を定義する原本ドキュメント

- [業務仕様README](./business/README.md) - 業務仕様一覧・概要
- [オークション業務](./business/auction.md) - Talk枠をオークション形式で販売する業務
- [ビデオ通話業務](./business/video-call.md) - インフルエンサーとファンの1対1ビデオ通話
- [決済業務](./business/payment.md) - Stripeを使用した安全な決済処理業務
- [ユーザー管理業務](./business/user-management.md) - 認証、プロフィール管理、インフルエンサー管理、フォロー、ランキング
- [用語集](./business/glossary.md) - ビジネス用語、技術用語、略語の定義集

### 機能仕様（/docs/functional/）

**目的**: 業務仕様を実現するための技術的な実装方針

#### コア機能
- [オークション機能](./functional/auction.md) - 入札、即決購入、終了処理
- [Talk機能](./functional/talk.md) - 枠作成、予約、通話実施
- [決済機能](./functional/payment.md) - Stripe連携、与信確保・決済確定
- [高度な決済フロー](./functional/ADVANCED_PAYMENT_FLOW.md) - Webhook活用、Talk完了検証の詳細仕様
- [通話ステータス管理](./functional/call-status-management.md) - call_slots.statusの更新管理

#### ユーザー機能
- [認証機能](./functional/authentication.md) - Supabase Auth、メール認証、OAuth
- [インフルエンサー管理機能](./functional/influencer.md) - ダッシュボード、売上管理
- [フォロー機能](./functional/follow.md) - フォロー/アンフォロー、優先表示
- [ランキング機能](./functional/ranking.md) - インフルエンサーランキング、人気Talk枠

#### API・データ構造
- [URLルーティング](./functional/URL_ROUTING.md) - APIエンドポイント一覧
- [テーブルスキーマ（MCP用）](./functional/TABLE_SCHEMA_MCP.md) - データベーススキーマ
- [ステージングテーブルスキーマ](./functional/STAGING_TABLE_SCHEMA.md) - ステージング環境のスキーマ

### テスト（/docs/test/）

- [テスト計画書](./test/plans/) - 各機能のテスト計画
- [E2Eテストガイド](./test/E2E_TEST_GUIDE.md) - E2Eテスト手順
- [ステージング環境テストガイド](./test/STAGING_E2E_TEST_GUIDE.md) - ステージング環境でのテスト手順
- [テストアカウント情報](./test/TEST_ACCOUNTS.md) - テスト用アカウント
- [テストカード登録ガイド](./test/TEST_CARD_REGISTRATION.md) - Stripeテストカード情報

### セットアップ・運用（/docs/setup/）

#### 環境構築
- [本番環境セットアップ](./setup/PRODUCTION_SETUP.md) - Production環境セットアップガイド
- [データベースマイグレーション](./setup/DATABASE_MIGRATIONS.md) - データベースマイグレーション管理
- [Supabase CLI認証](./setup/SUPABASE_CLI_AUTH.md) - Supabase CLI認証設定
- [マルチ環境セットアップ](./setup/MULTI_ENVIRONMENT_SETUP.md) - 複数環境（Staging/Production）のセットアップ
- [統一デプロイメント](./setup/UNIFIED_DEPLOYMENT.md) - デプロイメント手順

#### 外部サービス連携
- [Stripeセットアップ](./setup/STRIPE_SETUP_STEP_BY_STEP.md) - Stripe Connect & 決済フロー詳細セットアップ
- [Resend Emailセットアップ](./setup/RESEND_EMAIL_SETUP.md) - Resendメール送信設定
- [Daily.co Webhookセットアップ](./setup/DAILY_WEBHOOK_SETUP.md) - Daily.co Webhook設定
- [Supabase Edge Functionsセットアップ](./setup/SUPABASE_EDGE_FUNCTIONS_SETUP.md) - Edge Functions デプロイガイド

#### その他
- [クイックスタート](./setup/QUICK_START.md) - クイックスタートガイド
- [管理者ガイド](./setup/ADMIN_GUIDE.md) - 管理者向けガイド
- [技術スタック](./setup/TECH_STACK.md) - 使用技術の詳細
- [トラブルシューティング](./setup/troubleshooting/) - トラブルシューティングガイド
- [ユーザーガイド](./setup/user_guide/) - ユーザー向けガイド

### アーカイブ（/docs/archive/）

過去のドキュメントや完了報告書（参照専用）

### AI開発プロセス（/docs/ai_workflow/）

- [AI-TDD開発ガイド](./ai_workflow/AI_TDD_DEVELOPMENT_GUIDE.md) - AI駆動テスト開発の包括的ガイド（統合版）
- [コード変更ワークフロー](./ai_workflow/CODE_CHANGE_WORKFLOW.md) - コード変更のワークフローガイドライン

## 🗂️ ドキュメント体系

### 階層構造

```
業務仕様（What）
    ↓ 導出
テスト仕様（検証基準）
    ↓ 導出
機能仕様（How）
    ↓ 実装
コード
```

詳細は [/docs/ai_workflow/AI_TDD_DEVELOPMENT_GUIDE.md](./ai_workflow/AI_TDD_DEVELOPMENT_GUIDE.md) を参照してください。

## 💡 ドキュメントの使い方

### 新機能開発時
1. 対応する業務仕様（/docs/business/）を確認
2. 機能仕様（/docs/functional/）で実装詳細を確認
3. テスト計画（/docs/test/plans/）でテストケースを確認
4. 実装ファイルを参照
5. テストを実行

### バグ修正時
1. 関連する業務仕様を確認
2. 機能仕様のエラーハンドリングセクションを確認
3. 関連するデータ構造を確認
4. セキュリティ影響を検討

### レビュー時
1. 業務仕様との整合性確認
2. 機能仕様の実装確認
3. データ構造の変更有無確認
4. セキュリティ対策の実装確認

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

### データベース主要テーブル

| テーブル名 | 説明 | 詳細ドキュメント |
|-----------|------|----------------|
| `users` | ユーザー情報 | [認証機能](./functional/authentication.md) |
| `call_slots` | Talk枠 | [Talk機能](./functional/talk.md) |
| `auctions` | オークション | [オークション機能](./functional/auction.md) |
| `bids` | 入札履歴 | [オークション機能](./functional/auction.md) |
| `purchased_slots` | 購入済みTalk枠 | [Talk機能](./functional/talk.md) |
| `daily_call_events` | 通話イベントログ | [高度な決済フロー](./functional/ADVANCED_PAYMENT_FLOW.md) |
| `payment_transactions` | 決済履歴 | [決済機能](./functional/payment.md) |

## 関連ドキュメント

- [業務仕様](./business/) - ビジネス要件の原本
- [機能仕様](./functional/) - 実装詳細
- [テスト計画](./test/plans/) - テストケース
- [AI開発プロセス](./ai_workflow/AI_TDD_DEVELOPMENT_GUIDE.md) - 開発フロー

---

**最終更新日**: 2025-01-XX
