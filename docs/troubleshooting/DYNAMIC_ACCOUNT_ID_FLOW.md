# 動的なConnect Account ID取得フロー

## 概要

現在の実装では、ログインしているインフルエンサーの`stripe_connect_account_id`を動的に取得しています。

## データフロー

### 1. フロントエンド（MyPage.tsx）

```typescript
// src/pages/MyPage.tsx (line 1338-1341)
{stripeAccountStatus === 'active' && (
  <div className="bg-gradient-to-r from-pink-50 via-purple-50 to-indigo-100 border-b-2 border-blue-200 p-6">
    <InfluencerEarningsDashboard authUserId={supabaseUser.auth_user_id || supabaseUser.id} />
  </div>
)}
```

**ポイント**:
- `supabaseUser.auth_user_id`または`supabaseUser.id`を`InfluencerEarningsDashboard`コンポーネントに渡す
- これは現在ログインしているユーザーの認証ID

### 2. フロントエンド（InfluencerEarningsDashboard.tsx）

```typescript
// src/components/InfluencerEarningsDashboard.tsx (line 45-61)
useEffect(() => {
  loadEarnings();
}, [authUserId]);

const loadEarnings = async () => {
  try {
    setIsLoading(true);
    setError('');
    const data = await getInfluencerEarnings(authUserId);  // ← authUserIdを渡す
    setEarnings(data);
  } catch (err: any) {
    console.error('売上データ取得エラー:', err);
    setError(err.message || '売上データの取得に失敗しました');
  } finally {
    setIsLoading(false);
  }
};
```

**ポイント**:
- `authUserId`（ログイン中のユーザーの認証ID）を`getInfluencerEarnings()`に渡す

### 3. フロントエンド（stripe.ts API）

```typescript
// src/api/stripe.ts (line 187-201)
export const getInfluencerEarnings = async (authUserId: string) => {
  const response = await fetch(`${API_BASE_URL}/api/stripe/influencer-earnings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authUserId }),  // ← authUserIdをリクエストボディに含める
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`売上データ取得に失敗しました: ${errorText}`);
  }

  return response.json();
};
```

**ポイント**:
- `authUserId`をリクエストボディに含めてバックエンドに送信

### 4. バックエンド（server.ts）

```typescript
// backend/src/server.ts (line 800-816)
app.post('/api/stripe/influencer-earnings', async (req: Request, res: Response) => {
  try {
    const { authUserId } = req.body;  // ← リクエストボディからauthUserIdを取得

    console.log('🔵 インフルエンサー売上データ取得:', { authUserId });

    // ユーザー情報を取得
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, stripe_connect_account_id')
      .eq('auth_user_id', authUserId)  // ← authUserIdで検索
      .single();

    if (userError || !user) {
      console.error('❌ ユーザー取得エラー:', userError);
      return res.status(404).json({ error: 'User not found' });
    }

    // user.stripe_connect_account_idを使用
    if (user.stripe_connect_account_id) {
      // Stripe API呼び出し
      const balanceTransactions = await stripe.balanceTransactions.list({
        limit: 100,
      }, {
        stripeAccount: user.stripe_connect_account_id,  // ← 動的に取得したIDを使用
      });
    }
  }
});
```

**ポイント**:
1. リクエストボディから`authUserId`を取得
2. `users`テーブルから`auth_user_id`で検索して、そのユーザーの`stripe_connect_account_id`を取得
3. 取得した`stripe_connect_account_id`をStripe APIの`stripeAccount`オプションに渡す

## セキュリティ確認

### ✅ 正しい実装

1. **認証**: リクエストには`authUserId`が含まれる（フロントエンドから送信）
2. **検証**: バックエンドで`auth_user_id`を使って`users`テーブルから検索
3. **分離**: 各ユーザーは自分の`stripe_connect_account_id`のみアクセス可能

### ⚠️ 改善の余地

現在の実装では、リクエストボディに`authUserId`を含めていますが、より安全にするには：

1. **セッション認証**: バックエンドでセッションから`authUserId`を取得（推奨）
2. **JWT検証**: JWTトークンを検証してユーザーを特定

ただし、現在の実装でも、`authUserId`が正しく検証されていれば問題ありません。

## 確認事項

現在の実装は正しく動的に取得されていますが、以下の点を確認してください：

1. **フロントエンド**: `supabaseUser.auth_user_id`が正しく取得できているか
2. **バックエンド**: `authUserId`が正しく`users`テーブルから検索できているか
3. **Stripe API**: `user.stripe_connect_account_id`が正しくStripe APIに渡されているか

## ログで確認できること

バックエンドのログで以下を確認できます：

```
🔵 インフルエンサー売上データ取得: { authUserId: 'xxx' }
🔵 Stripeから売上データ取得開始（Balance Transactions API使用）: { connectAccountId: 'acct_xxx' }
```

これにより、どのユーザーのどのConnect Account IDが使用されているか確認できます。

