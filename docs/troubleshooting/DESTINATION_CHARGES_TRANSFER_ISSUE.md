# Destination Charges方式での送金問題のトラブルシューティング

## 問題

オークション・通話が終了したが、インフルエンサーへの送金が実行されていない。

## ログ分析

### 観察されたログ

```
⚠️ 既に決済済みだが送金処理が未実行。送金処理を実行します: 2b74f0ec-a379-4b3d-b79b-b4407af32d0b
🔵 送金処理を実行: { purchasedSlotId, paymentIntentId, bidAmount }
🔵 インフルエンサー送金処理開始
❌ インフルエンサー送金エラー: You have insufficient available funds in your Stripe account
✅ 送金処理成功: 決済成功
```

### 問題点

1. **古いコードが実行されている可能性**
   - ログに「既に決済済みだが送金処理が未実行。送金処理を実行します」というメッセージが出ているが、現在のコードには存在しない
   - これは古いコードがまだStaging環境にデプロイされている可能性がある

2. **Destination Charges方式なのにTransfer処理が実行されている**
   - Destination Charges方式の場合、Transfer処理は不要（自動分割済み）
   - しかし、ログには送金処理が実行されている

3. **プラットフォームアカウントの残高不足**
   - `You have insufficient available funds in your Stripe account`
   - これはDirect Charges方式のTransfer処理で発生するエラー

## 原因の特定

### ステップ1: PaymentIntentの確認

PaymentIntent `pi_3SlTiuRYvf9NFShg0efKNOrm` がDestination Charges方式で作成されたかどうかを確認：

```bash
curl https://api.stripe.com/v1/payment_intents/pi_3SlTiuRYvf9NFShg0efKNOrm \
  -u sk_test_xxxxx: | python3 -m json.tool | grep -A 5 "application_fee_amount\|on_behalf_of\|transfer_data"
```

**確認ポイント**:
- `application_fee_amount`が設定されている → Destination Charges方式
- `on_behalf_of`が設定されている → Destination Charges方式
- `transfer_data.destination`が設定されている → Destination Charges方式

### ステップ2: コードの確認

現在のコードでは：
- Destination Charges方式の場合、`captureTalkPayment`でTransfer処理は実行しない
- Transfer処理はStripe Webhook（`payment_intent.succeeded`）で実行される
- Webhookで`application_fee_amount`をチェックして、Destination Charges方式の場合はTransfer処理をスキップ

## 解決方法

### 方法1: PaymentIntentがDestination Charges方式の場合

**問題**: 古いコードが実行されており、Destination Charges方式なのにTransfer処理が実行されている

**解決策**:
1. 最新のコードをStaging環境にデプロイ
2. PaymentIntentの`application_fee_amount`を確認
3. Destination Charges方式の場合は、Transfer処理が実行されないことを確認

### 方法2: PaymentIntentがDirect Charges方式の場合

**問題**: プラットフォームアカウントの残高不足

**解決策**:
1. Stripe Dashboardでプラットフォームアカウントの残高を確認
2. テストカード `4000000000000077` を使用して残高を追加
3. または、Stripe Webhook（`payment_intent.succeeded`）でTransfer処理が実行されるのを待つ

### 方法3: 手動でTransfer処理を実行

Direct Charges方式の場合、手動でTransfer処理を実行：

```bash
# PaymentIntent IDを取得
PAYMENT_INTENT_ID="pi_3SlTiuRYvf9NFShg0efKNOrm"

# PaymentIntentを取得
curl https://api.stripe.com/v1/payment_intents/$PAYMENT_INTENT_ID \
  -u sk_test_xxxxx: | python3 -m json.tool

# application_fee_amountが設定されていない場合（Direct Charges方式）
# Transferを実行
curl -X POST https://api.stripe.com/v1/transfers \
  -u sk_test_xxxxx: \
  -d "amount=160" \
  -d "currency=jpy" \
  -d "destination=acct_1SKrTLDYeJjwCo3O"
```

## 確認手順

1. **PaymentIntentの確認**
   ```bash
   curl https://api.stripe.com/v1/payment_intents/pi_3SlTiuRYvf9NFShg0efKNOrm \
     -u sk_test_xxxxx: | python3 -m json.tool
   ```

2. **payment_transactionsの確認**
   ```sql
   SELECT 
     id,
     stripe_payment_intent_id,
     stripe_transfer_id,
     amount,
     platform_fee,
     influencer_payout,
     status
   FROM payment_transactions
   WHERE purchased_slot_id = '2b74f0ec-a379-4b3d-b79b-b4407af32d0b';
   ```

3. **Stripe Webhookの確認**
   - Stripe Dashboard → Webhooks → イベントログ
   - `payment_intent.succeeded`イベントが送信されているか確認

## 期待される動作

### Destination Charges方式の場合

1. PaymentIntent作成時に`application_fee_amount`が設定される
2. Capture実行時に自動的に分割入金される
3. Transfer処理は不要（自動分割済み）
4. Webhookで`application_fee_amount`をチェックしてTransfer処理をスキップ

### Direct Charges方式の場合

1. PaymentIntent作成時に`application_fee_amount`が設定されない
2. Capture実行時にプラットフォームアカウントに入金
3. Webhook（`payment_intent.succeeded`）でTransfer処理を実行
4. プラットフォームアカウントの残高が十分である必要がある

## 次のステップ

1. PaymentIntent `pi_3SlTiuRYvf9NFShg0efKNOrm` の詳細を確認
2. `application_fee_amount`が設定されているかどうかを確認
3. 最新のコードがStaging環境にデプロイされているか確認
4. 必要に応じて、手動でTransfer処理を実行

