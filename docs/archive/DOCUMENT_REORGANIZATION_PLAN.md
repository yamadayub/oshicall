# ドキュメント整理計画書

## 現状分析レポート

### 現在のファイル一覧

#### /docs/requirements/ (業務要件)
- `BR-001-auction.md`: オークション機能の業務要件（ユーザーストーリー、ビジネスルール、機能要件）
- `BR-002-talk.md`: Talk（通話）機能の業務要件
- `BR-003-payment.md`: 決済機能の業務要件
- `BR-004-authentication.md`: 認証機能の業務要件
- `BR-005-influencer.md`: インフルエンサー管理機能の業務要件
- `BR-006-follow.md`: フォロー機能の業務要件
- `BR-007-ranking.md`: ランキング機能の業務要件
- `call-status-management.md`: 通話ステータス管理の業務要件（新規作成）
- `glossary.md`: 用語集
- `README.md`: 業務要件ドキュメントの説明

#### /docs/functional/ (機能仕様)
- `ADVANCED_PAYMENT_FLOW.md`: 高度な決済フローの技術仕様
- `functions/auction.md`: オークション機能の技術仕様（API設計、データ構造、実装詳細）
- `functions/talk.md`: Talk機能の技術仕様
- `functions/payment.md`: 決済機能の技術仕様
- `functions/authentication.md`: 認証機能の技術仕様
- `functions/influencer.md`: インフルエンサー管理機能の技術仕様
- `functions/follow.md`: フォロー機能の技術仕様
- `functions/ranking.md`: ランキング機能の技術仕様
- `functions/README.md`: 機能別ドキュメントの説明

#### /docs/test/ (テスト)
- `CALL_STATUS_MANAGEMENT_TEST_PLAN.md`: 通話ステータス管理のテスト計画書
- `E2E_TEST_GUIDE.md`: E2Eテストガイド
- `STAGING_E2E_TEST_GUIDE.md`: ステージング環境E2Eテストガイド
- `TEST_ACCOUNTS.md`: テストアカウント情報
- `TEST_CARD_REGISTRATION.md`: テストカード登録ガイド
- `README.md`: テストドキュメントの説明

#### /docs/guides/ (ガイド)
- `ADMIN_GUIDE.md`: 管理者ガイド
- `AUCTION_FINALIZATION_GUIDE.md`: オークション終了処理ガイド
- `DAILY_SETUP_GUIDE.md`: Daily.coセットアップガイド
- `FOLLOW_FEATURE.md`: フォロー機能ガイド
- `INFLUENCER_MANAGEMENT.md`: インフルエンサー管理ガイド
- `NEXT_STEPS.md`: 次のステップ
- `QUICK_START.md`: クイックスタートガイド
- `REQUIREMENTS.md`: 要件定義書（概要）
- `STORAGE_SETUP_GUIDE.md`: ストレージセットアップガイド
- `STRIPE_AUTHORIZATION_COMPLETE.md`: Stripe認証完了ガイド
- `STRIPE_CONNECT_IMPROVEMENTS.md`: Stripe Connect改善ガイド
- `STRIPE_INTEGRATION_PLAN.md`: Stripe統合計画
- `TECH_STACK.md`: 技術スタック

#### /docs/development/ (開発記録)
- `DAILY_VIDEO_CALL_COMPLETE.md`: Daily.coビデオ通話完成記録
- `DEVELOPMENT.md`: 開発環境セットアップガイド

#### /docs/archive/ (アーカイブ)
- `AUCTION_SYSTEM_COMPLETE.md`: オークションシステム完成記録
- `BID_IMPLEMENTATION_COMPLETE.md`: 入札実装完成記録
- `BIDDING_SYSTEM_COMPLETE.md`: 入札システム完成記録
- `README_DB_MIGRATION.md`: DBマイグレーションREADME
- `README.md`: アーカイブの説明
- `VIDEO_CALL_SUCCESS.md`: ビデオ通話成功記録

#### /docs/setup/ (セットアップ)
- `DAILY_WEBHOOK_SETUP.md`: Daily.co Webhookセットアップ
- `DATABASE_MIGRATIONS.md`: データベースマイグレーション
- `EDGE_FUNCTION_DASHBOARD_SETUP.md`: Edge Functionダッシュボードセットアップ
- `GIT_REMOTE_SETUP.md`: Gitリモートセットアップ
- `MCP_SETUP_GUIDE.md`: MCPセットアップガイド
- `MULTI_ENVIRONMENT_SETUP.md`: マルチ環境セットアップ
- `RESEND_EMAIL_SETUP.md`: Resend Emailセットアップ
- `RLS_MANAGEMENT.md`: RLS管理
- `STRIPE_SETUP_STEP_BY_STEP.md`: Stripeセットアップ手順
- `SUPABASE_CLI_AUTH.md`: Supabase CLI認証
- `SUPABASE_EDGE_FUNCTIONS_SETUP.md`: Supabase Edge Functionsセットアップ
- `SUPABASE_SETUP.md`: Supabaseセットアップ
- `UNIFIED_DEPLOYMENT.md`: 統一デプロイメント

#### /docs/api/ (API仕様)
- `STAGING_TABLE_SCHEMA.md`: ステージングテーブルスキーマ
- `TABLE_SCHEMA_MCP.md`: テーブルスキーマ（MCP用）
- `URL_ROUTING.md`: URLルーティング

#### /docs/troubleshooting/ (トラブルシューティング)
- `fix_google_auth_display_name.md`: Google認証表示名修正
- `FOLLOW_SETUP_TROUBLESHOOTING.md`: フォローセットアップトラブルシューティング
- `GITHUB_PUSH_FIX.md`: GitHub Push修正

#### /docs/user_guide/ (ユーザーガイド)
- `MOBILE_RESPONSIVE_IMPROVEMENTS.md`: モバイルレスポンシブ改善
- `PROFILE_IMAGE_EDITING.md`: プロフィール画像編集

#### /docs/ai_workflow/ (AI開発プロセス)
- `AI_DEVELOPMENT_GUIDE.md`: AI開発ガイド
- `AI_TDD_PROCESS_v3.md`: AI-TDDプロセス（v3）
- `templates/IMPLEMENTATION_PLAN.md`: 実装計画テンプレート

#### /docs/ (ルート)
- `CODE_CHANGE_WORKFLOW.md`: コード変更ワークフロー
- `README.md`: ドキュメント全体の説明
- `deployment/PRODUCTION_SETUP.md`: 本番環境セットアップ

---

## 分類案

### 業務仕様（/docs/business/）に移動

| ファイル | 現在の場所 | 移動先 | 理由 |
|----------|-----------|--------|------|
| BR-001-auction.md | /docs/requirements/ | /docs/business/auction.md | オークション業務のビジネスルールを定義 |
| BR-002-talk.md | /docs/requirements/ | /docs/business/video-call.md | ビデオ通話業務のビジネスルールを定義 |
| BR-003-payment.md | /docs/requirements/ | /docs/business/payment.md | 決済業務のビジネスルールを定義 |
| BR-004-authentication.md | /docs/requirements/ | /docs/business/user-management.md | ユーザー管理業務の一部（認証） |
| BR-005-influencer.md | /docs/requirements/ | /docs/business/user-management.md | ユーザー管理業務の一部（インフルエンサー管理） |
| BR-006-follow.md | /docs/requirements/ | /docs/business/user-management.md | ユーザー管理業務の一部（フォロー） |
| BR-007-ranking.md | /docs/requirements/ | /docs/business/user-management.md | ユーザー管理業務の一部（ランキング） |
| call-status-management.md | /docs/requirements/ | /docs/business/video-call.md | ビデオ通話業務の一部として統合 |
| glossary.md | /docs/requirements/ | /docs/business/glossary.md | 業務用語集 |

**注意**: BR-004〜BR-007は`user-management.md`に統合するか、個別ファイルとして保持するか要検討

### 機能仕様（/docs/functional/）に移動・整理

| ファイル | 現在の場所 | 移動先 | 理由 |
|----------|-----------|--------|------|
| functions/auction.md | /docs/functional/functions/ | /docs/functional/auction.md | オークション機能の技術仕様 |
| functions/talk.md | /docs/functional/functions/ | /docs/functional/talk.md | Talk機能の技術仕様 |
| functions/payment.md | /docs/functional/functions/ | /docs/functional/payment.md | 決済機能の技術仕様 |
| ADVANCED_PAYMENT_FLOW.md | /docs/functional/ | /docs/functional/payment.md | 決済機能の技術仕様として統合 |
| functions/authentication.md | /docs/functional/functions/ | /docs/functional/authentication.md | 認証機能の技術仕様 |
| functions/influencer.md | /docs/functional/functions/ | /docs/functional/influencer.md | インフルエンサー管理機能の技術仕様 |
| functions/follow.md | /docs/functional/functions/ | /docs/functional/follow.md | フォロー機能の技術仕様 |
| functions/ranking.md | /docs/functional/functions/ | /docs/functional/ranking.md | ランキング機能の技術仕様 |
| call-status-management.md | /docs/requirements/ | /docs/functional/call-status-management.md | 通話ステータス管理の技術仕様（機能要件として） |

### テスト計画（/docs/test/plans/）に移動

| ファイル | 現在の場所 | 移動先 | 理由 |
|----------|-----------|--------|------|
| CALL_STATUS_MANAGEMENT_TEST_PLAN.md | /docs/test/ | /docs/test/plans/call-status-management_TEST_PLAN.md | テスト計画書 |

### アーカイブ（/docs/archive/）に移動

| ファイル | 現在の場所 | 移動先 | 理由 |
|----------|-----------|--------|------|
| DAILY_VIDEO_CALL_COMPLETE.md | /docs/development/ | /docs/archive/ | 完了した作業記録 |
| DEVELOPMENT.md | /docs/development/ | /docs/archive/ | 古い開発環境セットアップガイド（setup/に統合済み） |
| guides/REQUIREMENTS.md | /docs/guides/ | /docs/archive/ | 古い要件定義書（business/に統合済み） |
| guides/STRIPE_AUTHORIZATION_COMPLETE.md | /docs/guides/ | /docs/archive/ | 完了した作業記録 |
| guides/STRIPE_CONNECT_IMPROVEMENTS.md | /docs/guides/ | /docs/archive/ | 完了した作業記録 |
| guides/STRIPE_INTEGRATION_PLAN.md | /docs/guides/ | /docs/archive/ | 完了した作業記録 |
| guides/AUCTION_FINALIZATION_GUIDE.md | /docs/guides/ | /docs/archive/ | 完了した作業記録 |
| guides/DAILY_SETUP_GUIDE.md | /docs/guides/ | /docs/archive/ | setup/に統合済み |
| guides/STORAGE_SETUP_GUIDE.md | /docs/guides/ | /docs/archive/ | setup/に統合済み |

### セットアップガイド（/docs/setup/）に統合

| ファイル | 現在の場所 | 移動先 | 理由 |
|----------|-----------|--------|------|
| guides/QUICK_START.md | /docs/guides/ | /docs/setup/QUICK_START.md | セットアップガイド |
| guides/ADMIN_GUIDE.md | /docs/guides/ | /docs/setup/ADMIN_GUIDE.md | 管理者向けセットアップガイド |

### その他（保持または要検討）

| ファイル | 現在の場所 | 移動先 | 理由 |
|----------|-----------|--------|------|
| CODE_CHANGE_WORKFLOW.md | /docs/ | /docs/ai_workflow/ | AI開発プロセス関連 |
| api/STAGING_TABLE_SCHEMA.md | /docs/api/ | /docs/functional/ | データ構造は機能仕様の一部 |
| api/TABLE_SCHEMA_MCP.md | /docs/api/ | /docs/functional/ | データ構造は機能仕様の一部 |
| api/URL_ROUTING.md | /docs/api/ | /docs/functional/ | API設計は機能仕様の一部 |
| guides/TECH_STACK.md | /docs/guides/ | /docs/setup/TECH_STACK.md | 技術スタック情報 |
| guides/NEXT_STEPS.md | /docs/guides/ | /docs/archive/ | 一時的なドキュメント |
| guides/FOLLOW_FEATURE.md | /docs/guides/ | /docs/archive/ | 完了した機能ガイド |
| guides/INFLUENCER_MANAGEMENT.md | /docs/guides/ | /docs/archive/ | 完了した機能ガイド |
| troubleshooting/* | /docs/troubleshooting/ | /docs/setup/troubleshooting/ | トラブルシューティングはセットアップ関連 |
| user_guide/* | /docs/user_guide/ | /docs/setup/user_guide/ | ユーザーガイドはセットアップ関連 |
| deployment/PRODUCTION_SETUP.md | /docs/deployment/ | /docs/setup/PRODUCTION_SETUP.md | デプロイメントはセットアップの一部 |

---

## 新規作成が必要なファイル

### /docs/business/
- `README.md`: 業務仕様一覧・概要
- `user-management.md`: ユーザー管理業務（認証、インフルエンサー管理、フォロー、ランキングを統合）

### /docs/functional/
- `README.md`: 機能仕様一覧

### /docs/test/plans/
- （ディレクトリ作成のみ、既存ファイルを移動）

---

## 統合/分割が必要なファイル

### 統合が必要

1. **BR-004〜BR-007 → user-management.md**
   - 認証、インフルエンサー管理、フォロー、ランキングは全てユーザー管理業務の一部
   - 1つのファイルに統合するか、個別ファイルとして保持するか要検討

2. **ADVANCED_PAYMENT_FLOW.md → payment.md**
   - 決済機能の技術仕様として統合

3. **call-status-management.md**
   - 業務仕様として`video-call.md`に統合
   - 機能仕様として`/docs/functional/call-status-management.md`に保持

### 分割が必要

1. **guides/REQUIREMENTS.md**
   - 既に`business/`に分割済みのため、アーカイブに移動

---

## 作業順序

1. ✅ 現状分析レポート作成（このファイル）
2. ⏳ レビュー & 承認待ち
3. ⏳ /docs/business/ ディレクトリ作成
4. ⏳ 業務仕様ファイルの移動・作成
5. ⏳ /docs/functional/ の整理
6. ⏳ /docs/test/plans/ の整理
7. ⏳ 不要ファイルのアーカイブ移動
8. ⏳ README.md の作成・更新

---

## 注意事項

- ファイル移動時は、内部リンクの更新が必要
- 既存のREADME.mdファイルは内容を確認してから統合
- アーカイブ移動は削除ではなく移動（履歴保持）

---

**作成日**: 2025-01-XX
**作成者**: AI Assistant
