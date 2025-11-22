# OshiTalk ドキュメント

このディレクトリには、OshiTalkの要件定義書と技術ドキュメントが含まれています。

## 📋 ドキュメント一覧

### 全体要件
- **[REQUIREMENTS.md](./REQUIREMENTS.md)** - 全体の要件定義、サービス概要、技術スタック

### 機能別要件定義

#### コア機能
- **[auction.md](./functions/auction.md)** - オークション機能（入札、即決購入、終了処理）
- **[talk.md](./functions/talk.md)** - Talk（通話）機能（枠作成、予約、通話実施）
- **[payment.md](./functions/payment.md)** - 決済・カード登録機能（Stripe連携、与信確保・決済確定）
- **[ADVANCED_PAYMENT_FLOW.md](./functional/ADVANCED_PAYMENT_FLOW.md)** - 高度な決済フロー（Webhook活用、Talk完了検証）

#### ユーザー機能
- **[authentication.md](./functions/authentication.md)** - ユーザー認証機能（Supabase Auth、メール認証、OAuth）
- **[influencer.md](./functions/influencer.md)** - インフルエンサー管理機能（ダッシュボード、売上管理）
- **[follow.md](./functions/follow.md)** - フォロー機能（フォロー/アンフォロー、優先表示）
- **[ranking.md](./functions/ranking.md)** - ランキング機能（インフルエンサーランキング、人気Talk枠）

### セットアップ・運用
- **[DATABASE_MIGRATIONS.md](./setup/DATABASE_MIGRATIONS.md)** - データベースマイグレーション管理ガイド（最新）
- **[SUPABASE_CLI_AUTH.md](./setup/SUPABASE_CLI_AUTH.md)** - Supabase CLI認証設定
- **[PRODUCTION_SETUP.md](./deployment/PRODUCTION_SETUP.md)** - Production環境セットアップガイド

### テスト・QA
- **[E2E_TEST_GUIDE.md](./test/E2E_TEST_GUIDE.md)** - E2Eテストガイド
- **[STAGING_E2E_TEST_GUIDE.md](./test/STAGING_E2E_TEST_GUIDE.md)** - ステージング環境テストガイド
- **[TEST_ACCOUNTS.md](./test/TEST_ACCOUNTS.md)** - テストアカウント情報
- **[TEST_CARD_REGISTRATION.md](./test/TEST_CARD_REGISTRATION.md)** - テストカード登録ガイド

### アーカイブ
- **[archive/](./archive/)** - 過去のプロジェクト履歴（参照専用）

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

### 主要なユーザーフロー

#### ファンの利用フロー
```
1. サービス閲覧
2. Talk枠発見
3. 新規登録・ログイン
4. カード情報登録
5. 入札 or 即決購入
6. オークション終了・落札
7. Talk実施
```

#### インフルエンサーの利用フロー
```
1. 新規登録・ログイン
2. Talk枠作成
3. オークション開始
4. 落札者決定
5. Talk実施
6. 売上確認
```

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

**インフラ**
- Heroku (本番環境)
- Supabase (DB・認証・ストレージ)

### データベース主要テーブル

| テーブル名 | 説明 | 詳細ドキュメント |
|-----------|------|----------------|
| `users` | ユーザー情報 | [authentication.md](./functions/authentication.md) |
| `call_slots` | Talk枠 | [talk.md](./functions/talk.md) |
| `auctions` | オークション | [auction.md](./functions/auction.md) |
| `bids` | 入札履歴 | [auction.md](./functions/auction.md) |
| `purchased_slots` | 購入済みTalk枠 | [talk.md](./functions/talk.md) |
| `follows` | フォロー関係 | [follow.md](./functions/follow.md) |

### API エンドポイント一覧

#### Stripe関連
- `POST /api/stripe/create-customer` - Stripe顧客作成
- `POST /api/stripe/attach-payment-method` - カード情報登録
- `POST /api/stripe/authorize-payment` - 与信確保
- `POST /api/stripe/capture-payment` - 決済確定
- `POST /api/stripe/cancel-payment` - 与信解放

#### オークション関連
- `POST /api/buy-now` - 即決購入

詳細は各機能ドキュメントを参照してください。

## 📝 更新履歴

- 2025-01-15: 初版作成（REQUIREMENTS.md, auction.md, talk.md, payment.md, authentication.md, influencer.md, follow.md, ranking.md）

## 🔗 関連リンク

- [Supabase ダッシュボード](https://supabase.com/dashboard)
- [Stripe ダッシュボード](https://dashboard.stripe.com/)
- [Heroku ダッシュボード](https://dashboard.heroku.com/)

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
