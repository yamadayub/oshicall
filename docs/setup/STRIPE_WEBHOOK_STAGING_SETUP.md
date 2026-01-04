# Stripe Webhook Staging環境セットアップガイド

## 概要

Staging環境でStripe Webhook（`payment_intent.succeeded`）を受信するための設定手順です。

## 前提条件

- Stripeテストモードアカウントがあること
- Staging環境（`https://staging.oshi-talk.com`）が稼働していること
- Herokuアプリ（`oshicall-staging`）がデプロイされていること

## セットアップ手順

### ステップ1: Stripe DashboardでWebhookエンドポイントを作成

1. [Stripe Dashboard > Webhooks（テストモード）](https://dashboard.stripe.com/test/webhooks)にアクセス

2. 「Add endpoint」をクリック

3. 以下を設定:
   - **Endpoint URL**: `https://staging.oshi-talk.com/api/stripe/webhook`
   - **Events to send**: `payment_intent.succeeded` を選択
   - 「Add endpoint」をクリック

4. **Signing secret**（`whsec_xxxxx`）をコピー
   - これは後でHeroku環境変数に設定します

### ステップ2: Heroku環境変数に設定

```bash
heroku config:set STRIPE_WEBHOOK_SECRET=whsec_xxxxx --app oshicall-staging
```

### ステップ3: 設定確認

```bash
# 環境変数確認
heroku config:get STRIPE_WEBHOOK_SECRET --app oshicall-staging

# ログ確認
heroku logs --tail --app oshicall-staging | grep "Webhook"
```

## 既存のPaymentIntentに対してWebhookを再送信

既にCapture済みのPaymentIntentに対してWebhookをテストする場合：

1. [Stripe Dashboard > Payments（テストモード）](https://dashboard.stripe.com/test/payments)にアクセス

2. 該当のPaymentIntentを開く

3. 右側の「...」メニューから「Send test webhook」を選択

4. イベントタイプ: `payment_intent.succeeded` を選択

5. 「Send test webhook」をクリック

6. Herokuログで確認:
```bash
heroku logs --tail --app oshicall-staging | grep "Transfer"
```

期待されるログ:
```
✅ Stripe Transfer作成成功: tr_xxxxx
✅ payment_transactions更新成功
```

## トラブルシューティング

### Webhookが届かない

1. **URL確認**
   - WebhookエンドポイントのURLが正しいか確認
   - `https://staging.oshi-talk.com/api/stripe/webhook`

2. **環境変数確認**
   ```bash
   heroku config:get STRIPE_WEBHOOK_SECRET --app oshicall-staging
   ```

3. **Stripe DashboardでWebhookログを確認**
   - [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/test/webhooks)
   - 該当エンドポイントをクリック
   - 「Recent events」で送信履歴を確認

4. **Herokuログでエラーを確認**
   ```bash
   heroku logs --tail --app oshicall-staging | grep -i "webhook\|error"
   ```

### Webhook検証エラー

- `STRIPE_WEBHOOK_SECRET`が正しく設定されているか確認
- Stripe Dashboardで表示されたSigning secretを使用しているか確認

### Transferが実行されない

1. **payment_transactionsテーブルを確認**
   - `stripe_transfer_id`が`null`か確認
   - `status`が`captured`か確認

2. **ログで確認**
   ```bash
   heroku logs --tail --app oshicall-staging | grep "Transfer処理開始"
   ```

3. **Stripe Connectアカウント確認**
   - インフルエンサーの`stripe_connect_account_id`が設定されているか確認

## 参考リンク

- [Stripe Webhook Documentation](https://stripe.com/docs/webhooks)
- [Stripe Webhook Events](https://stripe.com/docs/api/events/types)
- [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/test/webhooks)

