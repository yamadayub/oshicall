# Stripe Connect インフルエンサー体験改善提案

## 現状の実装

### 良い点 ✅
1. **Express Account使用**: 最も簡単な登録フロー
2. **Hosted Onboarding**: Stripeが登録UIを提供（多言語対応・最適化済み）
3. **ステータス同期**: `charges_enabled`, `payouts_enabled`で自動判定

### 課題 ⚠️
1. **決済状況の可視化不足**: インフルエンサーが売上・入金を確認できない
2. **Stripe Express Dashboard誘導**: ユーザーがStripeダッシュボードにアクセスする方法が不明確
3. **通知機能なし**: 売上発生・入金時の通知がない
4. **onboarding体験**: 途中離脱した場合の再開フローが不明確

---

## 推奨改善策

### 1. アプリ内売上ダッシュボード（優先度: 高）

インフルエンサーマイページに以下を追加：

```typescript
interface InfluencerEarnings {
  // 売上概要
  totalEarnings: number;        // 総売上（手数料差し引き後）
  pendingPayouts: number;       // 未入金額
  availableBalance: number;     // 入金可能額
  lastPayout: {
    amount: number;
    date: string;
    status: 'paid' | 'pending' | 'in_transit';
  };

  // 直近の売上履歴
  recentTransactions: Array<{
    id: string;
    talkTitle: string;
    fanName: string;
    amount: number;               // 手数料差し引き後の受取額
    platformFee: number;          // プラットフォーム手数料
    grossAmount: number;          // 総額
    completedAt: string;
    status: 'completed' | 'refunded';
  }>;

  // 月別統計
  monthlyStats: {
    currentMonth: {
      earnings: number;
      callCount: number;
      averagePrice: number;
    };
    previousMonth: {
      earnings: number;
      callCount: number;
    };
  };
}
```

**実装方法**:
- `payment_transactions` テーブルから集計
- リアルタイムではなく、Talk完了時に更新（パフォーマンス考慮）
- Stripeの入金スケジュールを表示（日本: T+7日）

---

### 2. Stripe Express Dashboardへの簡単アクセス（優先度: 高）

**Stripe Express Dashboardとは**:
- インフルエンサー専用の簡易ダッシュボード
- Stripeが提供する売上・入金・税務情報の確認画面
- 銀行口座情報の更新も可能

**実装**:
```typescript
// Express Dashboard Linkを生成
app.post('/api/stripe/create-login-link', async (req, res) => {
  const { accountId } = req.body;

  const loginLink = await stripe.accounts.createLoginLink(accountId);

  res.json({
    url: loginLink.url,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5分有効
  });
});
```

**UI配置**:
- マイページに「売上詳細を見る」ボタン
- クリックで新しいタブでStripe Express Dashboardを開く
- 初回アクセス時にガイド表示（「ここで詳細な売上・入金履歴を確認できます」）

---

### 3. オンボーディング体験の改善（優先度: 中）

#### 問題: 途中離脱したユーザーの再開方法が不明確

**現在のフロー**:
```
1. 「Stripe設定」ボタンクリック
2. Stripe Hosted Onboardingへ遷移
3. 途中で閉じる → 再度同じボタンを押す → 新しいアカウントが作成されてしまう
```

**改善フロー**:
```typescript
// server.ts に追加
app.post('/api/stripe/create-or-resume-onboarding', async (req, res) => {
  const { authUserId, email } = req.body;

  // 既存のアカウントIDを確認
  const { data: user } = await supabase
    .from('users')
    .select('stripe_connect_account_id, stripe_connect_account_status')
    .eq('auth_user_id', authUserId)
    .single();

  let accountId = user?.stripe_connect_account_id;

  // アカウントが存在しない、または前回のアカウントが無効な場合は新規作成
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      email,
      capabilities: { transfers: { requested: true } },
      metadata: { auth_user_id: authUserId },
    });
    accountId = account.id;

    await supabase
      .from('users')
      .update({ stripe_connect_account_id: accountId })
      .eq('auth_user_id', authUserId);
  }

  // 既存のアカウントの状態を確認
  const stripeAccount = await stripe.accounts.retrieve(accountId);

  // 完了済みの場合はダッシュボードリンクを返す
  if (stripeAccount.charges_enabled && stripeAccount.payouts_enabled) {
    const loginLink = await stripe.accounts.createLoginLink(accountId);
    return res.json({
      status: 'complete',
      dashboardUrl: loginLink.url
    });
  }

  // 未完了の場合はオンボーディングリンクを返す
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.FRONTEND_URL}/mypage?stripe_refresh=true`,
    return_url: `${process.env.FRONTEND_URL}/mypage?stripe_complete=true`,
    type: 'account_onboarding',
  });

  res.json({
    status: 'incomplete',
    onboardingUrl: accountLink.url
  });
});
```

**UIの改善**:
- ステータスに応じてボタン表示を変更
  - `not_setup`: 「銀行口座を登録する」
  - `incomplete`: 「登録を完了する（途中から再開）」
  - `pending`: 「審査中（通常1-2営業日）」
  - `active`: 「売上詳細を見る」

---

### 4. Webhookで入金通知（優先度: 中）

**Stripe Webhookイベント**:
- `payout.paid`: 入金完了時
- `payout.failed`: 入金失敗時
- `account.updated`: アカウント状態変更時

**実装**:
```typescript
// server.ts の Webhook処理に追加
if (event.type === 'payout.paid') {
  const payout = event.data.object;
  const accountId = event.account; // Connect Account ID

  // usersテーブルからインフルエンサーを特定
  const { data: influencer } = await supabase
    .from('users')
    .select('id, email, display_name')
    .eq('stripe_connect_account_id', accountId)
    .single();

  if (influencer) {
    // 通知を送信（例: メール or アプリ内通知）
    await sendPayoutNotification({
      userId: influencer.id,
      amount: payout.amount / 100,
      currency: payout.currency,
      arrivalDate: new Date(payout.arrival_date * 1000)
    });
  }
}
```

**通知内容例**:
```
件名: 💰 売上が入金されました

{influencer_name} 様

お疲れ様です！Oshi-Talkでの売上が入金されました。

入金額: ¥{amount}
入金日: {arrival_date}

詳細はマイページからご確認ください。
https://oshi-talk.com/mypage
```

---

### 5. 入金スケジュールの明示（優先度: 低）

**日本のStripe入金スケジュール**:
- デフォルト: T+7営業日（週次入金）
- Express Account: 変更不可（Standardアカウントならカスタマイズ可能）

**UI表示例**:
```
💡 入金について
・毎週月曜日に前週の売上が確定します
・確定から7営業日後に銀行口座へ入金されます
・例: 1/15（月）に確定 → 1/24（水）頃に入金
```

---

## 実装優先順位

### Phase 1: 最低限の改善（1-2日）
1. ✅ アプリ内売上ダッシュボード基本版
   - 総売上、未入金額、直近5件の取引履歴
2. ✅ Stripe Express Dashboardへのリンク追加
   - マイページに「詳細を見る」ボタン

### Phase 2: UX改善（2-3日）
3. ✅ オンボーディングフローの改善
   - 途中離脱からの再開対応
   - ステータス別のボタン表示
4. ✅ 入金通知機能
   - Webhook設定
   - メール通知（または将来的にアプリ内通知）

### Phase 3: 高度な機能（将来的）
5. 月別売上グラフ
6. 税務情報エクスポート（確定申告用）
7. 予測売上表示（入金予定日と金額）

---

## Stripe設定チェックリスト

### Stripeダッシュボードで確認すること

1. **Connect設定**
   - [ ] Express Accountが有効化されている
   - [ ] Webhook エンドポイント設定済み
     - URL: `https://oshi-talk.com/api/stripe/webhook`
     - イベント: `payout.paid`, `payout.failed`, `account.updated`

2. **ブランディング**（オプション）
   - [ ] Connect設定 → ブランディング
   - [ ] アイコン・ロゴをアップロード
   - [ ] サポートメール・電話番号を設定
   - → オンボーディング画面に表示される

3. **入金設定の確認**
   - [ ] Settings → Connect → Payouts
   - [ ] 入金スケジュールを確認（日本: T+7固定）

---

## 参考リンク

- [Stripe Connect Express Account](https://docs.stripe.com/connect/express-accounts)
- [Account Onboarding](https://docs.stripe.com/connect/onboarding/quickstart)
- [Express Dashboard](https://docs.stripe.com/connect/express-dashboard)
- [Stripe Payouts](https://docs.stripe.com/connect/payouts)
- [Webhook Events](https://docs.stripe.com/api/events/types)

---

## まとめ

**最もシンプルで効果的なアプローチ**:
1. アプリ内に**基本的な売上サマリー**を表示（総売上・未入金額・直近取引）
2. 詳細は**Stripe Express Dashboard**へ誘導（ボタン1つで簡単アクセス）
3. 重要イベント（入金完了）は**メール通知**

これにより、インフルエンサーは：
- アプリ内で売上をパッと確認できる
- 詳細はStripeの専門UIで確認できる（開発コスト削減）
- 入金時に自動通知を受け取れる

**次のステップ**: 上記Phase 1の実装から始めることをお勧めします。
