# Stripe Connect Capabilities修正ガイド

## 問題

Destination Charges方式を使用する際、以下のエラーが発生しました：

```
You cannot create a charge with the `on_behalf_of` parameter set to a connected account with `transfers` but without the `card_payments` capability enabled.
```

## 原因

Destination Charges方式を使用するには、Stripe Connectアカウントに以下のcapabilitiesが必要です：

1. **`transfers`** - 送金機能（既に有効）
2. **`card_payments`** - カード決済機能（これが有効になっていない）

現在のコードでは、Connectアカウント作成時に`transfers`のみをリクエストしており、`card_payments`がリクエストされていませんでした。

## 修正内容

### 1. コード修正

以下のエンドポイントで`card_payments` capabilityを追加しました：

- `/api/stripe/create-connect-account`
- `/api/stripe/create-or-resume-onboarding`

**修正前**:
```typescript
capabilities: {
  transfers: { requested: true },
}
```

**修正後**:
```typescript
capabilities: {
  transfers: { requested: true },
  card_payments: { requested: true }, // Destination Charges方式に必要
}
```

### 2. 既存のConnectアカウントへの対応

既存のConnectアカウントに対しては、以下のいずれかの方法で`card_payments` capabilityを有効化する必要があります：

#### 方法1: Stripe Dashboardから手動で有効化（推奨）

1. Stripe Dashboardにログイン
2. Connect → Accounts に移動
3. 該当するConnectアカウントを選択
4. Settings → Capabilities に移動
5. `card_payments` capabilityを有効化

#### 方法2: APIで有効化

```typescript
// 既存のConnectアカウントに対してcard_payments capabilityをリクエスト
await stripe.accounts.update(connectAccountId, {
  capabilities: {
    card_payments: { requested: true },
  },
});
```

#### 方法3: オンボーディングを再開

既存のConnectアカウントのオンボーディングを再開することで、`card_payments` capabilityが自動的にリクエストされます。

## 確認方法

### Connectアカウントのcapabilitiesを確認

```typescript
const account = await stripe.accounts.retrieve(connectAccountId);
console.log('Capabilities:', account.capabilities);
// 期待される出力:
// {
//   card_payments: 'active', // または 'pending'
//   transfers: 'active',
// }
```

### Destination Charges方式が使用可能か確認

```typescript
const account = await stripe.accounts.retrieve(connectAccountId);
const canUseDestinationCharges = 
  account.capabilities?.card_payments === 'active' &&
  account.capabilities?.transfers === 'active' &&
  account.charges_enabled === true &&
  account.payouts_enabled === true;

console.log('Destination Charges方式が使用可能:', canUseDestinationCharges);
```

## 注意事項

1. **capabilityの有効化には時間がかかる場合があります**
   - `card_payments` capabilityは、Stripeの審査が必要な場合があります
   - 審査が完了するまで、`pending`状態になることがあります

2. **既存のConnectアカウントへの影響**
   - 既存のConnectアカウントに対しては、手動で`card_payments` capabilityを有効化する必要があります
   - または、オンボーディングを再開することで自動的にリクエストされます

3. **フォールバック動作**
   - `card_payments` capabilityが有効でない場合、自動的にDirect Charges方式にフォールバックします
   - ただし、エラーが発生するため、capabilityを有効化する必要があります

## テスト手順

1. 新しいConnectアカウントを作成
2. オンボーディングを完了
3. `card_payments` capabilityが有効になっていることを確認
4. オークションに入札してDestination Charges方式が動作することを確認

## 関連ドキュメント

- [Stripe Connect Capabilities](https://stripe.com/docs/connect/account-capabilities)
- [Destination Charges](https://stripe.com/docs/connect/destination-charges)
- [Stripe Connect Account Capabilities API](https://stripe.com/docs/api/accounts/update#update_account-capabilities)

