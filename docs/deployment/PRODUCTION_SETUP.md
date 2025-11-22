# 🚀 Production環境セットアップガイド

## 📋 概要

推しトークのProduction環境を新規作成するための包括的なガイドです。Staging環境（`oshicall`）から独立したProduction環境を構築します。

## 🎯 ゴール

- **oshicall-prod** Herokuアプリの作成
- Production用Supabaseプロジェクトの構築
- Production用Stripeアカウント設定
- Production用Daily.co設定
- カスタムドメイン設定
- セキュリティ強化設定

## 📋 前提条件

- Heroku CLIインストール済み
- Supabase CLIインストール済み
- Stripeアカウント（Production用）
- Daily.coアカウント（Production用）
- カスタムドメイン取得済み（オプション）

---

## 🚀 ステップバイステップガイド

### ステップ1: Heroku Productionアプリ作成

```bash
# Productionアプリ作成
heroku create oshicall-prod --region us

# アプリ確認
heroku apps:info --app oshicall-prod

# Git remote追加（stagingと区別）
git remote add production https://git.heroku.com/oshicall-prod.git
```

### ステップ2: Supabase Productionプロジェクト作成

```bash
# 新しいSupabaseプロジェクト作成
supabase projects create oshicall-production

# プロジェクト一覧確認
supabase projects list

# ローカル設定（production環境用）
cp supabase/config.example.toml supabase/config.production.toml
# config.production.toml を編集して新しいプロジェクトの設定を入力
```

### ステップ3: データベースマイグレーション適用

```bash
# Productionプロジェクトに接続
supabase link --project-ref YOUR_PRODUCTION_PROJECT_REF

# マイグレーション適用
supabase db push

# Edge Functionsデプロイ
supabase functions deploy
```

### ステップ4: Production環境変数設定

#### Heroku環境変数
```bash
# Supabase設定
heroku config:set SUPABASE_URL=https://your-prod-project.supabase.co --app oshicall-prod
heroku config:set SUPABASE_ANON_KEY=your_prod_anon_key --app oshicall-prod
heroku config:set SUPABASE_SERVICE_ROLE_KEY=your_prod_service_role_key --app oshicall-prod

# Stripe設定（Production）
heroku config:set STRIPE_PUBLISHABLE_KEY=pk_live_... --app oshicall-prod
heroku config:set STRIPE_SECRET_KEY=sk_live_... --app oshicall-prod
heroku config:set STRIPE_WEBHOOK_SECRET=whsec_... --app oshicall-prod

# Daily.co設定（Production）
heroku config:set DAILY_API_KEY=your_prod_daily_key --app oshicall-prod
heroku config:set DAILY_DOMAIN=your_prod_domain.daily.co --app oshicall-prod

# その他の設定
heroku config:set NODE_ENV=production --app oshicall-prod
heroku config:set VITE_ENVIRONMENT=production --app oshicall-prod
```

#### 環境変数ファイル作成
```bash
# Production用の環境変数ファイル作成
cp env.production.example .env.production
# .env.production を編集して実際の値を設定
```

### ステップ5: Stripe Production設定

#### Stripe Connect設定
1. [Stripe Dashboard](https://dashboard.stripe.com/) にアクセス
2. **Settings > Connect > Settings** で以下を設定：
   - Platform name: OshiTalk Production
   - Website: https://oshicall.com
   - Terms of service: 利用規約URL
   - Privacy policy: プライバシーポリシーURL

#### Webhook設定
```bash
# Webhookエンドポイント作成
stripe listen --forward-to https://oshicall-prod.herokuapp.com/api/webhooks/stripe
```

### ステップ6: Daily.co Production設定

1. [Daily.co Dashboard](https://dashboard.daily.co/) にアクセス
2. **Developers > API Keys** でProduction用APIキー作成
3. **Domain** 設定でProductionドメイン追加
4. **Recording** 設定（オプション）

#### Webhook設定（重要）

Daily.co Webhookは、Talk完了を検証して決済を確定するために**必須**です。

```bash
# Daily.co Webhook作成
curl -X POST https://api.daily.co/v1/webhooks \
  -H "Authorization: Bearer ${DAILY_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://oshi-talk.com/api/daily/webhook"}'

# Webhook確認
curl -X GET https://api.daily.co/v1/webhooks \
  -H "Authorization: Bearer ${DAILY_API_KEY}"
```

**現在の設定（Production）:**
- Webhook URL: `https://oshi-talk.com/api/daily/webhook`
- UUID: `e2f06847-84b4-4a06-b859-9b0993b321da`
- State: `ACTIVE`

**詳細:** [高度な決済フロー](../functional/ADVANCED_PAYMENT_FLOW.md)を参照してください。

### ステップ7: デプロイ実行

```bash
# Productionブランチ作成（オプション）
git checkout -b production
git push production main

# 初回デプロイ
heroku run bash --app oshicall-prod
# 内部で: npm run heroku-postbuild が自動実行される
```

### ステップ8: DNS設定（カスタムドメイン使用時）

```bash
# カスタムドメイン設定
heroku domains:add www.oshicall.com --app oshicall-prod
heroku domains:add oshicall.com --app oshicall-prod

# DNSレコード確認
heroku domains --app oshicall-prod
```

### ステップ9: SSL証明書設定

```bash
# SSL証明書自動設定（HerokuのAutomated Certificate Management）
heroku certs:auto:enable --app oshicall-prod
```

---

## 🔧 運用設定

### ログ監視
```bash
# ログ確認
heroku logs --tail --app oshicall-prod

# ログレベル設定
heroku config:set LOG_LEVEL=info --app oshicall-prod
```

### パフォーマンス監視
```bash
# Heroku Metrics確認
heroku addons:create heroku-metrics --app oshicall-prod

# メモリ使用量確認
heroku ps --app oshicall-prod
```

### バックアップ設定
```bash
# Supabaseバックアップ設定
supabase db dump --db-url "postgresql://..." > backup.sql

# 定期バックアップ（Heroku Scheduler使用）
heroku addons:create scheduler:standard --app oshicall-prod
```

---

## 🧪 テスト手順

### デプロイスモークテスト
```bash
# ヘルスチェック
curl https://oshicall-prod.herokuapp.com/health

# アプリ起動確認
curl https://oshicall-prod.herokuapp.com/

# APIテスト
curl https://oshicall-prod.herokuapp.com/api/status
```

### 機能テスト
1. ✅ ユーザー登録/ログイン
2. ✅ Talk枠一覧表示
3. ✅ オークション入札
4. ✅ 決済処理
5. ✅ ビデオ通話

---

## 🔒 セキュリティ設定

### 環境変数の確認
```bash
# 機密情報が漏洩していないか確認
heroku config --app oshicall-prod | grep -E "(SECRET|KEY|TOKEN)"
```

### CORS設定
```bash
# 本番ドメインのみ許可
heroku config:set ALLOWED_ORIGINS=https://oshicall.com,https://www.oshicall.com --app oshicall-prod
```

### Rate Limiting
```bash
# APIレート制限設定
heroku config:set RATE_LIMIT_WINDOW=15 --app oshicall-prod
heroku config:set RATE_LIMIT_MAX_REQUESTS=100 --app oshicall-prod
```

---

## 🚨 トラブルシューティング

### よくある問題

#### デプロイ失敗
```bash
# ビルドログ確認
heroku logs --app oshicall-prod --source heroku

# ローカルビルドテスト
npm run build
```

#### データベース接続エラー
```bash
# Supabase接続確認
heroku run bash --app oshicall-prod
# 内部で: npx supabase db ping
```

#### 環境変数エラー
```bash
# 環境変数確認
heroku config --app oshicall-prod

# 環境変数再設定
heroku config:set VARIABLE_NAME=value --app oshicall-prod
```

---

## 📊 モニタリング設定

### Heroku Metrics
- CPU使用率
- メモリ使用量
- レスポンスタイム
- エラーレート

### Supabase Metrics
- データベース接続数
- クエリ実行時間
- ストレージ使用量

### Stripeダッシュボード
- 決済成功率
- チャージバック率
- 収益分析

---

## 🎯 リリースチェックリスト

### Pre-Launch
- [ ] Productionアプリ作成完了
- [ ] Supabase Production設定完了
- [ ] Stripe Production設定完了
- [ ] Daily.co Production設定完了
- [ ] 環境変数設定完了
- [ ] SSL証明書設定完了

### Launch
- [ ] DNS設定完了
- [ ] 初回デプロイス成功
- [ ] スモークテスト通過
- [ ] 機能テスト通過

### Post-Launch
- [ ] ログ監視設定完了
- [ ] バックアップ設定完了
- [ ] パフォーマンス監視設定完了
- [ ] セキュリティ監査完了

---

## 📞 サポート

問題が発生した場合：

1. **Herokuサポート**: https://help.heroku.com/
2. **Supabaseサポート**: https://supabase.com/support
3. **Stripeサポート**: https://stripe.com/docs/support
4. **Daily.coサポート**: https://docs.daily.co/

---

## 📝 更新履歴

- **2025-01-XX**: Production環境セットアップガイド作成
