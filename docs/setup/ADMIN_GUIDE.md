# OshiTalk 運営管理ガイド

## 📋 インフルエンサー承認管理

### ユーザーをインフルエンサーとして承認

```sql
-- メールアドレスで承認
UPDATE users
SET is_influencer = TRUE
WHERE auth_user_id = (
  SELECT id FROM auth.users WHERE email = 'user@example.com'
);

-- 表示名で承認
UPDATE users
SET is_influencer = TRUE
WHERE display_name = 'ユーザー名';

-- ユーザーIDで承認
UPDATE users
SET is_influencer = TRUE
WHERE id = 'user-uuid-here';
```

### 承認済みユーザー一覧を確認

```sql
SELECT
  u.id,
  u.display_name,
  au.email,
  u.is_fan,
  u.is_influencer,
  u.is_verified,
  u.total_earnings,
  u.total_calls_completed,
  u.created_at
FROM users u
JOIN auth.users au ON u.auth_user_id = au.id
WHERE u.is_influencer = TRUE
ORDER BY u.created_at DESC;
```

### インフルエンサー権限を取り消し

```sql
-- is_influencerをFALSEに（ファンとしては残る）
UPDATE users
SET is_influencer = FALSE
WHERE auth_user_id = (
  SELECT id FROM auth.users WHERE email = 'user@example.com'
);
```

### すべてのユーザーを表示

```sql
SELECT
  u.display_name,
  au.email,
  CASE
    WHEN u.is_influencer = TRUE AND u.is_fan = TRUE THEN '両方'
    WHEN u.is_influencer = TRUE THEN 'インフルエンサーのみ'
    WHEN u.is_fan = TRUE THEN 'ファンのみ'
    ELSE '未設定'
  END as ユーザータイプ,
  u.created_at as 登録日
FROM users u
JOIN auth.users au ON u.auth_user_id = au.id
ORDER BY u.created_at DESC;
```

### 一括承認

```sql
UPDATE users
SET is_influencer = TRUE
WHERE auth_user_id IN (
  SELECT id FROM auth.users
  WHERE email IN (
    'user1@example.com',
    'user2@example.com',
    'user3@example.com'
  )
);
```

## 📊 統計情報

### インフルエンサー活動状況

```sql
SELECT
  u.display_name,
  au.email,
  u.is_verified,
  u.total_earnings,
  u.total_calls_completed,
  u.average_rating,
  COUNT(cs.id) as Talk枠数
FROM users u
JOIN auth.users au ON u.auth_user_id = au.id
LEFT JOIN call_slots cs ON u.id = cs.user_id
WHERE u.is_influencer = TRUE
GROUP BY u.id, au.email
ORDER BY u.total_earnings DESC;
```

### 最近の Talk 枠

```sql
SELECT
  u.display_name as インフルエンサー名,
  cs.title,
  cs.scheduled_start_time,
  cs.starting_price,
  cs.is_published,
  a.status as オークション状態,
  a.total_bids_count as 入札数
FROM call_slots cs
JOIN users u ON cs.user_id = u.id
LEFT JOIN auctions a ON cs.id = a.call_slot_id
WHERE u.is_influencer = TRUE
ORDER BY cs.created_at DESC
LIMIT 20;
```

## 🔍 検証済みインフルエンサーマーク

```sql
-- 認証済みマークを付与
UPDATE users
SET is_verified = TRUE
WHERE auth_user_id = (
  SELECT id FROM auth.users WHERE email = 'user@example.com'
);

-- 認証済みマークを削除
UPDATE users
SET is_verified = FALSE
WHERE auth_user_id = (
  SELECT id FROM auth.users WHERE email = 'user@example.com'
);
```

## 🆘 トラブルシューティング

### Q: ユーザーがインフルエンサーに切り替えできない

A: `is_influencer`フラグが`TRUE`になっているか確認:

```sql
SELECT is_influencer
FROM users
WHERE auth_user_id = (SELECT id FROM auth.users WHERE email = 'user@example.com');
```

### Q: インフルエンサーとファンの両方になれる？

A: はい、可能です。`is_fan`と`is_influencer`の両方を`TRUE`にできます。

### Q: ユーザーがログアウト後も切り替えできない

A: ログアウト → ログインして最新のデータを取得してください。
