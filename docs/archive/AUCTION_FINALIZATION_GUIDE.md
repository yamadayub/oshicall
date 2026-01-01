# オークション終了処理セットアップガイド

## 🎯 実装内容

オークション終了時に自動的に：
1. 最高入札者の与信を決済確定（Payment Intent Capture）
2. 他の入札者の与信をキャンセル
3. purchased_slotsに記録
4. payment_transactionsに記録
5. ユーザー統計を更新

---

## 📝 セットアップ手順

### ステップ1: RPC関数を作成

Supabase SQL Editorで `supabase_rpc_functions.sql` を実行：

```sql
-- ユーザー統計更新のRPC関数

-- 既存の関数を削除
DROP FUNCTION IF EXISTS update_user_statistics(UUID, UUID, DECIMAL);

-- ユーザー統計を更新する関数
CREATE OR REPLACE FUNCTION update_user_statistics(
  p_fan_id UUID,
  p_influencer_id UUID,
  p_amount DECIMAL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- ファン（落札者）の統計を更新
  UPDATE users
  SET 
    total_spent = total_spent + p_amount,
    total_calls_purchased = total_calls_purchased + 1,
    updated_at = NOW()
  WHERE id = p_fan_id;
  
  -- インフルエンサーの統計を更新
  UPDATE users
  SET 
    total_earnings = total_earnings + (p_amount * 0.8), -- 80%（手数料20%引き）
    total_calls_completed = total_calls_completed + 1,
    updated_at = NOW()
  WHERE id = p_influencer_id;
  
  RAISE NOTICE '✅ ユーザー統計更新完了: Fan=%, Influencer=%, Amount=%', p_fan_id, p_influencer_id, p_amount;
END;
$$;

-- 実行権限を付与
GRANT EXECUTE ON FUNCTION update_user_statistics(UUID, UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_statistics(UUID, UUID, DECIMAL) TO service_role;
```

### ステップ2: バックエンドを再起動

ローカルで確認：
```bash
# バックエンドを再起動（nodemonが自動的に再起動するはず）
# または手動で
pkill -f "ts-node src/server.ts"
cd backend && npm run dev
```

### ステップ3: 手動テスト

#### オークションを終了させる

Supabase SQL Editorで：

```sql
-- テスト用: オークション終了時刻を過去にする
UPDATE auctions
SET end_time = NOW() - INTERVAL '1 minute'
WHERE id = 'あなたが入札したauction_id';

-- 確認
SELECT 
  id,
  call_slot_id,
  end_time,
  status,
  current_highest_bid
FROM auctions
WHERE end_time < NOW()
  AND status = 'active';
```

#### APIを手動実行

```bash
curl -X POST http://localhost:3001/api/auctions/finalize-ended \
  -H "Content-Type: application/json"
```

期待される出力：
```json
{
  "processed": 1,
  "results": [
    {
      "auction_id": "xxx",
      "status": "success",
      "winner_id": "xxx",
      "amount": 8600
    }
  ],
  "timestamp": "2025-10-11T..."
}
```

#### バックエンドログを確認

`tail -f /tmp/backend.log` で以下が表示されるはず：

```
🔵 オークション終了処理開始
🔵 1件のオークションを処理します
🔵 オークション処理: auction_xxx
🔵 最高入札: ¥8600 by user_xxx
🔵 Payment Intent Capture: pi_xxx
✅ 決済確定成功: ¥8600
✅ purchased_slots記録成功: purchased_xxx
✅ payment_transactions記録成功
🔵 他の入札者の与信をキャンセル: 0件
✅ オークション終了処理完了
```

#### Stripeダッシュボードで確認

1. https://dashboard.stripe.com/test/payments を開く
2. 最新のPayment Intentを確認
3. **Status**: `Succeeded` ← 決済確定済み！
4. **Amount captured**: ¥8,600

---

## 🔄 自動実行の設定（オプション）

### 方法A: Supabase Cron Jobs（推奨）

1. https://app.supabase.com/project/your-project-id/database/cron-jobs を開く
2. 「New cron job」をクリック
3. 設定：

```
Name: finalize-auctions
Schedule: */1 * * * * （毎分実行）
SQL Command:
```

```sql
SELECT net.http_post(
  url := 'https://oshicall-2936440db16b.herokuapp.com/api/auctions/finalize-ended',
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := '{}'::jsonb
);
```

### 方法B: GitHub Actions（代替案）

`.github/workflows/finalize-auctions.yml` を作成して、GitHub Actionsで定期実行

---

## 🧪 完全なテストシナリオ

### シナリオ1: 正常な落札

```
1. ユーザーA: ¥1,000 で入札
2. ユーザーB: ¥1,500 で入札
3. オークション終了時刻が過ぎる
4. API実行:
   - ユーザーBの与信を決済確定 → ¥1,500請求
   - ユーザーAの与信をキャンセル → ホールド解除
5. ユーザーBが落札
6. purchased_slotsに記録
```

### シナリオ2: 入札なし

```
1. 誰も入札しなかった
2. オークション終了時刻が過ぎる
3. API実行:
   - オークションをended状態に更新
   - 何も請求しない
```

---

## 📊 データベース確認

### オークション後の状態確認

```sql
-- 落札情報を確認
SELECT 
  ps.id,
  ps.call_slot_id,
  ps.buyer_user_id,
  ps.purchased_price,
  ps.platform_fee,
  ps.influencer_payout,
  u.display_name as buyer_name
FROM purchased_slots ps
JOIN users u ON ps.buyer_user_id = u.id
ORDER BY ps.created_at DESC
LIMIT 10;

-- 決済情報を確認
SELECT 
  pt.id,
  pt.stripe_payment_intent_id,
  pt.amount,
  pt.platform_fee,
  pt.influencer_payout,
  pt.status,
  pt.created_at
FROM payment_transactions pt
ORDER BY pt.created_at DESC
LIMIT 10;

-- ユーザー統計を確認
SELECT 
  display_name,
  total_spent,
  total_calls_purchased,
  total_earnings,
  total_calls_completed
FROM users
WHERE total_spent > 0 OR total_earnings > 0;
```

---

## ✅ 完了チェックリスト

- [ ] `supabase_rpc_functions.sql` を実行
- [ ] バックエンド再起動確認
- [ ] テスト用にオークション終了時刻を過去に設定
- [ ] 手動でAPI実行してテスト
- [ ] Stripeダッシュボードで決済確認
- [ ] purchased_slotsテーブルを確認
- [ ] ユーザー統計を確認
- [ ] （オプション）Supabase Cronを設定

---

まず、`supabase_rpc_functions.sql` をSupabase SQL Editorで実行してください！

