# RLS（Row Level Security）管理ガイド

RLSポリシーによる意図しない不具合を防ぐための管理方法とベストプラクティスです。

**最終更新**: 2025年12月28日

---

## 目次

- [RLSポリシーの問題点](#rlsポリシーの問題点)
- [ベストプラクティス](#ベストプラクティス)
- [デバッグ方法](#デバッグ方法)
- [よくある問題と解決方法](#よくある問題と解決方法)
- [チェックリスト](#チェックリスト)

---

## RLSポリシーの問題点

### 1. 問題が発生しやすい理由

- **クエリ側でのフィルタリングとRLSの競合**
  - フロントエンドで`.eq('fan_user_id', userId)`を指定しても、RLSポリシーが先に適用される
  - RLSポリシーが`get_current_user_id()`を使用している場合、クエリ側でのフィルタリングは不要

- **ポリシーの重複**
  - 複数のポリシーが存在し、どれが適用されているか不明確
  - 古いポリシーが残っている場合、予期しない動作が発生

- **関数の依存関係**
  - `get_current_user_id()`などの関数が正しく動作しているか確認が必要
  - 関数の定義が変更されると、すべてのポリシーに影響

### 2. 典型的な症状

- データが取得できない（RLSでブロックされている）
- 一部のユーザーだけがデータを取得できない
- 開発環境では動作するが、本番環境で動作しない
- クエリを実行しても空の結果が返る

---

## ベストプラクティス

### 1. RLSポリシーの統一

**原則**: すべてのRLSポリシーは`get_current_user_id()`を使用する

```sql
-- ✅ 良い例: get_current_user_id()を使用
CREATE POLICY "Users can view their own purchased slots"
ON purchased_slots FOR SELECT
USING (
  fan_user_id = get_current_user_id()
);

-- ❌ 悪い例: サブクエリを使用（パフォーマンスが悪く、無限再帰のリスク）
CREATE POLICY "Users can view their own purchased slots"
ON purchased_slots FOR SELECT
USING (
  fan_user_id IN (
    SELECT id FROM users WHERE auth_user_id = auth.uid()
  )
);
```

### 2. クエリ側でのフィルタリングを避ける

**原則**: RLSポリシーに完全に依存し、クエリ側での追加フィルタリングは行わない

```typescript
// ✅ 良い例: RLSポリシーに完全に依存
const { data: purchasedSlots } = await supabase
  .from('purchased_slots')
  .select('id, call_slot_id')
  .in('call_slot_id', callSlotIds);
  // .eq('fan_user_id', userId) は不要（RLSが自動的にフィルタリング）

// ❌ 悪い例: クエリ側でフィルタリング（RLSと競合する可能性）
const { data: purchasedSlots } = await supabase
  .from('purchased_slots')
  .select('id, call_slot_id')
  .in('call_slot_id', callSlotIds)
  .eq('fan_user_id', userId); // RLSと重複
```

### 3. ポリシーの命名規則

**原則**: 明確で一貫性のある命名規則を使用

```sql
-- パターン1: ユーザータイプ + アクション
"Users can view their own purchased slots"
"Influencers can view their sold slots"

-- パターン2: テーブル名 + アクション
"purchased_slots_select_own"
"purchased_slots_select_sold"
```

### 4. ポリシーの冪等性

**原則**: マイグレーションは何回実行しても安全にする

```sql
-- ✅ 良い例: IF EXISTS / IF NOT EXISTSを使用
DROP POLICY IF EXISTS "Users can view their own purchased slots" ON purchased_slots;
CREATE POLICY "Users can view their own purchased slots"
ON purchased_slots FOR SELECT
USING (fan_user_id = get_current_user_id());

CREATE INDEX IF NOT EXISTS idx_purchased_slots_fan_user_id ON purchased_slots(fan_user_id);
```

### 5. ポリシーのテスト

**原則**: マイグレーション適用後、必ずテストする

```sql
-- テスト用SQL: 現在のユーザーでpurchased_slotsを取得できるか確認
SELECT 
  id,
  call_slot_id,
  fan_user_id,
  influencer_user_id
FROM purchased_slots
WHERE call_slot_id = '85a47898-0f4b-44db-ba2c-683348fc97d5';
```

---

## デバッグ方法

### 1. 現在のRLSポリシーを確認

```sql
-- すべてのポリシーを確認
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'purchased_slots'
ORDER BY policyname;
```

### 2. RLSが有効か確認

```sql
-- RLSが有効か確認
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'purchased_slots';
```

### 3. 関数の動作確認

```sql
-- get_current_user_id()が正しく動作するか確認
SELECT get_current_user_id();

-- 現在のauth.uid()と比較
SELECT 
  auth.uid() as auth_uid,
  get_current_user_id() as user_id,
  id,
  auth_user_id
FROM users
WHERE auth_user_id = auth.uid();
```

### 4. 実際のクエリをシミュレート

```sql
-- フロントエンドのクエリを再現
-- 注意: このクエリは現在の認証ユーザーで実行される
SELECT 
  id,
  call_slot_id,
  purchased_at,
  call_status,
  winning_bid_amount
FROM purchased_slots
WHERE call_slot_id IN ('85a47898-0f4b-44db-ba2c-683348fc97d5');
```

### 5. ログを確認

フロントエンドのコンソールログを確認：

```typescript
// src/api/purchasedTalks.ts
console.log('🔍 [getPurchasedTalks] purchased_slots取得結果:', {
  'purchasedSlots件数': purchasedSlots?.length || 0,
  'purchasedSlots': purchasedSlots,
  'purchasedError': purchasedError,
  'callSlotIds': callSlotIds,
  'userId': userId,
});
```

---

## よくある問題と解決方法

### 問題1: データが取得できない

**症状**: クエリを実行しても空の結果が返る

**原因**:
- RLSポリシーが正しく設定されていない
- `get_current_user_id()`が`NULL`を返している
- クエリ側でのフィルタリングがRLSと競合している

**解決方法**:
1. RLSポリシーを確認
2. `get_current_user_id()`の動作を確認
3. クエリ側でのフィルタリングを削除

### 問題2: 一部のユーザーだけがデータを取得できない

**症状**: 特定のユーザーだけがデータを取得できない

**原因**:
- `users.auth_user_id`と`auth.uid()`が一致していない
- `get_current_user_id()`が正しく動作していない

**解決方法**:
1. `users`テーブルで`auth_user_id`を確認
2. `get_current_user_id()`の動作を確認
3. 必要に応じて`users.auth_user_id`を更新

### 問題3: 開発環境では動作するが、本番環境で動作しない

**症状**: Stagingでは動作するが、Productionで動作しない

**原因**:
- マイグレーションがProduction環境に適用されていない
- Production環境のRLSポリシーが古い

**解決方法**:
1. マイグレーション履歴を確認
2. Production環境にマイグレーションを適用
3. RLSポリシーを確認

### 問題4: 無限再帰エラー

**症状**: `infinite recursion detected in policy`エラーが発生

**原因**:
- RLSポリシー内で同じテーブルを参照している
- `get_current_user_id()`が正しく定義されていない

**解決方法**:
1. `get_current_user_id()`が`SECURITY DEFINER`と`SET LOCAL row_security = off`を使用しているか確認
2. ポリシー内で同じテーブルを参照しないようにする

---

## チェックリスト

### 新しいRLSポリシーを追加する前

- [ ] 既存のポリシーを確認（重複がないか）
- [ ] `get_current_user_id()`を使用する
- [ ] ポリシー名が明確で一貫性がある
- [ ] `DROP POLICY IF EXISTS`を使用して冪等性を保つ

### マイグレーション適用後

- [ ] Staging環境でテスト
- [ ] 実際のクエリで動作確認
- [ ] ログを確認してエラーがないか確認
- [ ] Gitにコミット
- [ ] Production環境に適用
- [ ] Production環境でも動作確認

### 問題が発生した時

- [ ] 現在のRLSポリシーを確認
- [ ] `get_current_user_id()`の動作を確認
- [ ] クエリ側でのフィルタリングを削除
- [ ] ログを確認
- [ ] 実際のクエリをシミュレート

---

## 参考リンク

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Database Migrations Guide](./DATABASE_MIGRATIONS.md)

