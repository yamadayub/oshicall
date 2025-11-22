# 🚀 Production環境セットアップガイド

## 📋 概要

OshiTalkのProduction環境セットアップの完全ガイドです。Staging環境（`oshicall-staging`）から独立したProduction環境（`oshicall-production`）を構築します。

## 🎯 完成した環境

### ドメイン構成
- **Production:** https://oshi-talk.com
- **Staging:** https://staging.oshi-talk.com

### インフラ構成
| サービス | Production | Staging |
|---------|-----------|---------|
| **Heroku App** | oshicall-production | oshicall-staging |
| **Supabase Project** | oshicall-production (atkhwwqunwmpzqkgavtx) | oshicall-staging (wioealhsienyubwegvdu) |
| **ドメイン** | oshi-talk.com | staging.oshi-talk.com |
| **DNS管理** | Cloudflare | Cloudflare |
| **SSL** | Cloudflare Full (strict) | Cloudflare Full (strict) |

## 📋 前提条件

- Heroku CLIインストール済み
- Supabase CLIインストール済み
- Stripe Liveアカウント
- Daily.coアカウント
- Cloudflareアカウント（DNS管理）
- カスタムドメイン（oshi-talk.com）取得済み

---

## 🚀 ステップバイステップガイド

### ステップ1: Supabase Productionプロジェクト作成

```bash
# 1. Supabase Dashboardでプロジェクト作成
# プロジェクト名: oshicall-production
# リージョン: Tokyo (ap-northeast-1)
# データベースパスワード: 安全なパスワードを設定

# 2. プロジェクト参照IDを確認
# Project Settings > General > Reference ID
# 例: atkhwwqunwmpzqkgavtx

# 3. ローカルで接続
supabase link --project-ref atkhwwqunwmpzqkgavtx

# 4. プロジェクト参照IDを保存（後で使用）
echo "atkhwwqunwmpzqkgavtx" > supabase/.temp/project-ref
```

### ステップ2: データベースマイグレーション適用

**重要:** 初回セットアップ時は、Stagingから取得したスキーマを使用します。

```bash
# 初期スキーママイグレーションを適用
SUPABASE_ACCESS_TOKEN="your_access_token" \
  npx supabase db push \
  --db-url "postgresql://postgres.atkhwwqunwmpzqkgavtx:$SUPABASE_DB_PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"

# マイグレーション履歴確認
SUPABASE_ACCESS_TOKEN="your_access_token" \
  npx supabase migration list \
  --db-url "postgresql://postgres.atkhwwqunwmpzqkgavtx:$SUPABASE_DB_PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"
```

**適用されるマイグレーション:**
- `20251113000000_initial_schema.sql` - 初期スキーマ（11テーブル、6 ENUM型）

詳細は [DATABASE_MIGRATIONS.md](../setup/DATABASE_MIGRATIONS.md) を参照してください。

### ステップ3: Heroku Productionアプリ作成

```bash
# Productionアプリ作成
heroku create oshicall-production --region us

# アプリ確認
heroku apps:info --app oshicall-production

# Git remote追加（stagingと区別）
git remote add production https://git.heroku.com/oshicall-production.git
```

### ステップ4: Production環境変数設定

#### Heroku環境変数

**実際の設定内容（Production - oshicall-production）:**

```bash
# Supabase設定
heroku config:set SUPABASE_URL=https://atkhwwqunwmpzqkgavtx.supabase.co --app oshicall-production
heroku config:set SUPABASE_ANON_KEY=<Supabase Project Settings > API > anon public> --app oshicall-production
heroku config:set SUPABASE_SERVICE_ROLE_KEY=<Supabase Project Settings > API > service_role> --app oshicall-production

# Stripe設定（Live Keys）
heroku config:set STRIPE_PUBLISHABLE_KEY=pk_live_... --app oshicall-production
heroku config:set STRIPE_SECRET_KEY=sk_live_... --app oshicall-production
heroku config:set STRIPE_WEBHOOK_SECRET=whsec_kPYFFL7KmE0u3hhVHkpyz0VidHWcddDr --app oshicall-production
heroku config:set STRIPE_CONNECT_WEBHOOK_SECRET=whsec_jnK8EWONJkF2TaCvu4tqr4QlqP3Jp1ba --app oshicall-production

# Daily.co設定
heroku config:set DAILY_API_KEY=bbc2e4684848f2b4b0c5352fa96a3d9495277abf63be6112974ddc2fc1d38e4b --app oshicall-production

# フロントエンドURL
heroku config:set FRONTEND_URL=https://oshi-talk.com --app oshicall-production

# Node環境
heroku config:set NODE_ENV=production --app oshicall-production
```

**参考: Staging環境設定（oshicall-staging）:**

```bash
# Supabase設定
heroku config:set SUPABASE_URL=https://wioealhsienyubwegvdu.supabase.co --app oshicall-staging

# Stripe設定（Test Keys）
heroku config:set STRIPE_SECRET_KEY=sk_test_... --app oshicall-staging

# フロントエンドURL
heroku config:set FRONTEND_URL=https://staging.oshi-talk.com --app oshicall-staging
```

#### Supabase Edge Functions環境変数（Production）

```bash
# Resend（メール送信）
SUPABASE_ACCESS_TOKEN="your_token" npx supabase secrets set \
  RESEND_API_KEY=re_... \
  FROM_EMAIL="OshiTalk <noreply@oshi-talk.com>" \
  APP_URL=https://oshi-talk.com \
  --project-ref atkhwwqunwmpzqkgavtx

# 設定確認
SUPABASE_ACCESS_TOKEN="your_token" npx supabase secrets list --project-ref atkhwwqunwmpzqkgavtx
```

### ステップ5: Stripe Production設定

#### Stripe Connect設定
1. [Stripe Dashboard](https://dashboard.stripe.com/) にアクセス
2. **Settings > Connect > Settings** で以下を設定：
   - Platform name: OshiTalk
   - Website: https://oshi-talk.com
   - Terms of service: https://oshi-talk.com/terms
   - Privacy policy: https://oshi-talk.com/privacy

#### Webhook設定（2種類必要）

**1. プラットフォームWebhook（お客様のアカウント）**

エンドポイント: `https://oshi-talk.com/api/stripe/webhook`

イベント:
- `payment_intent.succeeded` - 決済成功
- `payment_intent.payment_failed` - 決済失敗
- `charge.refunded` - 返金完了

```bash
# Stripe Dashboardで設定
# Webhook Secret: whsec_kPYFFL7KmE0u3hhVHkpyz0VidHWcddDr
```

**2. Connectアカウント Webhook**

エンドポイント: `https://oshi-talk.com/api/stripe/connect/webhook`

イベント:
- `account.updated` - Connectアカウント更新
- `account.application.authorized` - 認証完了
- `account.application.deauthorized` - 認証解除
- `payout.created` - 出金作成
- `payout.paid` - 出金完了
- `payout.failed` - 出金失敗

```bash
# Stripe Dashboardで設定
# Webhook Secret: whsec_jnK8EWONJkF2TaCvu4tqr4QlqP3Jp1ba
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

### ステップ7: Resend（メール送信）設定

#### ドメイン認証設定

1. [Resend Dashboard](https://resend.com/domains) でドメイン追加: `oshi-talk.com`

2. **Cloudflare DNSにレコード追加:**

| Type | Name | Value |
|------|------|-------|
| TXT | @ | `v=spf1 include:_spf.google.com include:_spf.resend.com ~all` |
| TXT | resend._domainkey | （Resendが提供するDKIM値） |
| TXT | _dmarc | `v=DMARC1; p=none` |

3. **ドメイン検証:**
```bash
# Resend Dashboardで検証ボタンをクリック
# Status: Verified になることを確認
```

#### サブドメイン自動継承

`staging.oshi-talk.com`は親ドメイン`oshi-talk.com`の設定を自動的に継承します。追加設定は不要です。

### ステップ8: DNS設定（Cloudflare）

#### ドメイン切り替え前の状態
- `oshi-talk.com` → Staging環境
- `staging.oshi-talk.com` → 未設定

#### 切り替え後の状態
- `oshi-talk.com` → **Production環境**
- `staging.oshi-talk.com` → **Staging環境**

#### Cloudflare DNS設定

**1. Herokuドメインを追加:**
```bash
# Production
heroku domains:add oshi-talk.com --app oshicall-production
heroku domains:add www.oshi-talk.com --app oshicall-production

# Staging
heroku domains:add staging.oshi-talk.com --app oshicall-staging

# Heroku DNSターゲット確認
heroku domains --app oshicall-production
heroku domains --app oshicall-staging
```

**2. Cloudflare DNSレコード設定:**

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | @ | evolutionary-larkspur-emz3tr8hhqd2vkrqwfd3a460.herokudns.com | ✅ Proxied |
| CNAME | www | endothelial-panther-loylkoz1latbcxsh01s3da0k.herokudns.com | ✅ Proxied |
| CNAME | staging | fundamental-ridge-569s1489idtqpjl3ffj170tj.herokudns.com | ✅ Proxied |

**3. SSL/TLS設定:**
```bash
# Cloudflare: SSL/TLS > Overview
# Encryption mode: Full (strict)

# Heroku: SSL証明書を有効化
heroku certs:auto:enable --app oshicall-production
heroku certs:auto:enable --app oshicall-staging
```

**注意:** Heroku ACMがSSL証明書を発行するまで、一時的にCloudflareのProxyを無効化（DNS only）する必要があります。証明書発行後、Proxyを再度有効化してください。

### ステップ10: デプロイ実行

```bash
# Productionにデプロイ
git push production main

# デプロイログ確認
heroku logs --tail --app oshicall-production

# アプリ起動確認
heroku ps --app oshicall-production
```

**ビルドプロセス:**
1. Heroku buildpackがNode.jsを検出
2. `npm install`でパッケージインストール
3. `npm run heroku-postbuild`でフロントエンドビルド
4. バックエンドサーバーが`backend/src/server.ts`から起動

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
curl https://oshi-talk.com/health
# 期待: {"status":"ok","timestamp":"..."}

# APIテスト
curl https://oshi-talk.com/api/status
# 期待: 200 OK

# フロントエンド確認
curl -I https://oshi-talk.com/
# 期待: 200 OK + HTML
```

### 機能テスト（E2Eテスト推奨）
1. ✅ ユーザー登録/ログイン
2. ✅ Talk枠一覧表示
3. ✅ カード登録
4. ✅ オークション入札
5. ✅ オークション終了・落札
6. ✅ ビデオ通話開始
7. ✅ **Daily.co Webhook受信確認**
8. ✅ **決済判定・確定（Talk完了後）**

**重要:** ステップ7-8は高度な決済フローの検証です。詳細は [ADVANCED_PAYMENT_FLOW.md](../functional/ADVANCED_PAYMENT_FLOW.md) を参照してください。

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
- [x] Supabase Productionプロジェクト作成（atkhwwqunwmpzqkgavtx）
- [x] データベースマイグレーション適用
- [x] Heroku Productionアプリ作成（oshicall-production）
- [x] Heroku環境変数設定完了
- [x] Supabase Edge Functions環境変数設定完了
- [x] Stripe Connect設定完了
- [x] Stripe Webhook設定完了（プラットフォーム + Connect）
- [x] Daily.co Webhook設定完了（UUID: e2f06847-84b4-4a06-b859-9b0993b321da）
- [x] Resendドメイン認証完了（oshi-talk.com）

### DNS & SSL
- [x] Cloudflare DNS設定完了
  - [x] oshi-talk.com → Production
  - [x] www.oshi-talk.com → Production
  - [x] staging.oshi-talk.com → Staging
- [x] Heroku ACM有効化完了
- [x] Cloudflare SSL/TLS設定（Full strict）

### Launch
- [x] 初回デプロイ成功
- [x] スモークテスト通過
- [ ] E2E機能テスト通過（特に高度な決済フロー）
- [ ] 本番データ投入

### Post-Launch
- [ ] ログ監視設定
- [ ] エラー通知設定
- [ ] パフォーマンス監視設定
- [ ] バックアップ設定
- [ ] セキュリティ監査

---

## 📊 現在の環境構成サマリー

### Production環境（oshi-talk.com）
```
Heroku App: oshicall-production
Supabase: atkhwwqunwmpzqkgavtx (Tokyo)
Stripe: Live mode
Daily.co: Webhook Active (e2f06847-84b4-4a06-b859-9b0993b321da)
Resend: oshi-talk.com (Verified)
SSL: Cloudflare Full (strict) + Heroku ACM
```

### Staging環境（staging.oshi-talk.com）
```
Heroku App: oshicall-staging
Supabase: wioealhsienyubwegvdu (Tokyo)
Stripe: Test mode
Daily.co: No webhook (optional)
Resend: 親ドメインoshi-talk.comを継承
SSL: Cloudflare Full (strict) + Heroku ACM
```

---

## 📞 サポート

問題が発生した場合：

1. **Herokuサポート**: https://help.heroku.com/
2. **Supabaseサポート**: https://supabase.com/support
3. **Stripeサポート**: https://stripe.com/docs/support
4. **Daily.coサポート**: https://docs.daily.co/
5. **Cloudflareサポート**: https://support.cloudflare.com/
6. **Resendサポート**: https://resend.com/docs

---

## 📝 更新履歴

- **2025-11-22**: Production環境セットアップ完了、高度な決済フロー実装
- **2025-01-15**: 初版作成
