# Stripe Connect Capabilities確認方法

## 問題

Destination Charges方式を使用する際、`card_payments` capabilityが`active`である必要がありますが、Stripe DashboardでCapabilitiesの設定場所が見つからない場合があります。

## 確認方法

### 方法1: Stripe Dashboard（日本語版）

1. **Stripe Dashboardにログイン**
   - https://dashboard.stripe.com/ にアクセス

2. **Connect → アカウント（Accounts）に移動**
   - 左側のメニューから「Connect」を選択
   - 「アカウント」または「Accounts」を選択

3. **該当するConnectアカウントを選択**
   - リストから該当するインフルエンサーのアカウントをクリック

4. **Capabilitiesの確認**
   - **Expressアカウントの場合**:
     - アカウント詳細ページの上部に「機能」または「Capabilities」セクションが表示されます
     - または、「設定」→「機能」の順に移動
   - **Customアカウントの場合**:
     - 「設定」→「機能」の順に移動

5. **`card_payments`の状態を確認**
   - `card_payments`が`active`（有効）になっているか確認
   - `pending`（保留中）や`inactive`（無効）の場合は、有効化が必要です

### 方法2: APIで直接確認（推奨）

Stripe APIを使用して、Connectアカウントのcapabilitiesを直接確認できます。

#### ステップ1: ConnectアカウントIDを取得

```sql
-- SupabaseでConnectアカウントIDを確認
SELECT id, display_name, stripe_connect_account_id 
FROM users 
WHERE is_influencer = true;
```

#### ステップ2: Stripe CLIまたはcurlで確認

```bash
# Stripe CLIを使用（推奨）
stripe accounts retrieve acct_xxxxx

# またはcurlを使用
curl https://api.stripe.com/v1/accounts/acct_xxxxx \
  -u sk_test_xxxxx:
```

#### ステップ3: レスポンスからcapabilitiesを確認

レスポンスの`capabilities`セクションを確認：

```json
{
  "id": "acct_xxxxx",
  "capabilities": {
    "card_payments": "active",  // ← これが "active" である必要がある
    "transfers": "active"
  },
  "charges_enabled": true,
  "payouts_enabled": true
}
```

### 方法3: アプリケーションのエンドポイントを使用

既存の`/api/stripe/influencer-status`エンドポイントを使用して確認：

```bash
# インフルエンサーの状態を確認
curl -X POST https://staging.oshi-talk.com/api/stripe/influencer-status \
  -H "Content-Type: application/json" \
  -d '{
    "authUserId": "インフルエンサーのauth_user_id"
  }'
```

**注意**: 修正したコードがStaging環境にデプロイされていない場合、`capabilities`と`canUseDestinationCharges`はレスポンスに含まれません。その場合は、方法2（APIで直接確認）を使用してください。

レスポンス例（修正後）：

```json
{
  "accountStatus": "active",
  "accountId": "acct_xxxxx",
  "isVerified": true,
  "chargesEnabled": true,
  "payoutsEnabled": true,
  "detailsSubmitted": true,
  "capabilities": {
    "card_payments": "active",  // ← これが "active" である必要がある
    "transfers": "active"
  },
  "canUseDestinationCharges": true  // ← これが true である必要がある
}
```

## 問題の解決方法

### `card_payments`が`pending`または`inactive`の場合

#### 方法1: オンボーディングを再開（推奨）

既存のConnectアカウントのオンボーディングを再開することで、`card_payments` capabilityが自動的にリクエストされます。

```bash
# アプリケーションのエンドポイントを使用
curl -X POST https://staging.oshi-talk.com/api/stripe/create-or-resume-onboarding \
  -H "Content-Type: application/json" \
  -d '{
    "authUserId": "インフルエンサーのauth_user_id",
    "email": "インフルエンサーのメールアドレス"
  }'
```

#### 方法2: APIで直接リクエスト

```bash
# Stripe APIでcard_payments capabilityをリクエスト
curl https://api.stripe.com/v1/accounts/acct_xxxxx \
  -u sk_test_xxxxx: \
  -X POST \
  -d "capabilities[card_payments][requested]=true"
```

#### 方法3: Stripe Dashboardから有効化

1. Connect → アカウント → 該当アカウント
2. 「設定」→「機能」に移動
3. `card_payments` capabilityを有効化

## 注意事項

1. **capabilityの有効化には時間がかかる場合があります**
   - `card_payments` capabilityは、Stripeの審査が必要な場合があります
   - 審査が完了するまで、`pending`状態になることがあります

2. **Expressアカウントの場合**
   - Expressアカウントでは、オンボーディング完了時に自動的に`card_payments` capabilityがリクエストされます
   - オンボーディングが完了していない場合は、オンボーディングを完了する必要があります

3. **既存のアカウントへの影響**
   - 既存のConnectアカウントに対しては、手動で`card_payments` capabilityを有効化する必要がある場合があります
   - または、オンボーディングを再開することで自動的にリクエストされます

## トラブルシューティング

### Capabilitiesが見つからない場合

1. **アカウントタイプを確認**
   - Expressアカウント: アカウント詳細ページの上部に表示
   - Customアカウント: 設定 → 機能

2. **権限を確認**
   - Connectアカウントの管理者権限が必要です
   - プラットフォームアカウントの管理者としてログインしていることを確認

3. **APIで直接確認**
   - 上記の「方法2: APIで直接確認」を使用

## 関連ドキュメント

- [Stripe Connect Capabilities](https://stripe.com/docs/connect/account-capabilities)
- [Destination Charges](https://stripe.com/docs/connect/destination-charges)
- [Stripe Connect Account API](https://stripe.com/docs/api/accounts/retrieve)

