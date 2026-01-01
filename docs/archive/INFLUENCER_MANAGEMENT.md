# インフルエンサー管理ガイド

このドキュメントは、OshiTalk プラットフォームのインフルエンサーを管理するための運営向けガイドです。

## 📋 概要

インフルエンサー機能は**運営承認制**です。ユーザーが自由にインフルエンサーになることはできず、運営が承認したユーザーのみがインフルエンサー機能を利用できます。

## 🔐 承認フロー

```
1. ユーザーがファンとして登録
   ↓
2. 運営がデータベースで承認フラグを立てる
   ↓
3. ユーザーが「インフルエンサーになる」ボタンをクリック
   ↓
4. インフルエンサーとして活動開始
```

## 🛠️ 承認手順

### 1. データベースの確認

Supabase Dashboard → SQL Editor で以下を実行:

```sql
-- すべてのファンユーザーを表示
SELECT
  f.id,
  f.display_name,
  u.email,
  f.can_be_influencer as 承認状態,
  f.created_at as 登録日,
  CASE
    WHEN EXISTS (SELECT 1 FROM influencers WHERE auth_user_id = f.auth_user_id)
    THEN 'インフルエンサー登録済み'
    ELSE '未登録'
  END as ステータス
FROM fans f
JOIN auth.users u ON f.auth_user_id = u.id
ORDER BY f.created_at DESC;
```

### 2. インフルエンサー承認

#### A. メールアドレスで承認

```sql
UPDATE fans
SET can_be_influencer = TRUE
WHERE auth_user_id = (
  SELECT id FROM auth.users WHERE email = 'user@example.com'
);
```

#### B. 表示名で承認

```sql
UPDATE fans
SET can_be_influencer = TRUE
WHERE display_name = 'ユーザー名';
```

#### C. ユーザー ID で承認

```sql
UPDATE fans
SET can_be_influencer = TRUE
WHERE id = 'fan-uuid-here';
```

### 3. 承認確認

```sql
-- 承認済みユーザーの確認
SELECT
  f.display_name,
  u.email,
  f.can_be_influencer,
  CASE
    WHEN EXISTS (SELECT 1 FROM influencers WHERE auth_user_id = f.auth_user_id)
    THEN '✅ インフルエンサー登録済み'
    ELSE '⏳ 承認済み（未登録）'
  END as ステータス
FROM fans f
JOIN auth.users u ON f.auth_user_id = u.id
WHERE f.can_be_influencer = TRUE
ORDER BY f.created_at DESC;
```

## 📊 管理クエリ集

### 承認済みユーザー一覧

```sql
SELECT
  f.id,
  f.display_name as 表示名,
  u.email as メール,
  f.created_at as 登録日,
  CASE
    WHEN EXISTS (SELECT 1 FROM influencers WHERE auth_user_id = f.auth_user_id)
    THEN 'インフルエンサー活動中'
    ELSE '承認済み（未活動）'
  END as ステータス
FROM fans f
JOIN auth.users u ON f.auth_user_id = u.id
WHERE f.can_be_influencer = TRUE
ORDER BY f.created_at DESC;
```

### インフルエンサーの活動状況

```sql
SELECT
  i.display_name as インフルエンサー名,
  u.email,
  i.total_earnings as 総収益,
  i.total_calls_completed as 完了通話数,
  i.average_rating as 平均評価,
  i.is_verified as 認証済み,
  COUNT(cs.id) as Talk枠数
FROM influencers i
JOIN auth.users u ON i.auth_user_id = u.id
LEFT JOIN call_slots cs ON i.id = cs.influencer_id
GROUP BY i.id, u.email
ORDER BY i.total_earnings DESC;
```

### 最近の Talk 枠

```sql
SELECT
  i.display_name as インフルエンサー名,
  cs.title as Talk枠タイトル,
  cs.scheduled_start_time as 開始時刻,
  cs.starting_price as 開始価格,
  cs.is_published as 公開状態,
  a.status as オークション状態,
  a.total_bids_count as 入札数
FROM call_slots cs
JOIN influencers i ON cs.influencer_id = i.id
LEFT JOIN auctions a ON cs.id = a.call_slot_id
ORDER BY cs.created_at DESC
LIMIT 20;
```

## 🚫 承認の取り消し

### インフルエンサー権限の剥奪

```sql
-- 承認フラグを取り消す
UPDATE fans
SET can_be_influencer = FALSE
WHERE auth_user_id = (
  SELECT id FROM auth.users WHERE email = 'user@example.com'
);

-- 既存のインフルエンサーアカウントを削除（必要な場合）
DELETE FROM influencers
WHERE auth_user_id = (
  SELECT id FROM auth.users WHERE email = 'user@example.com'
);
```

⚠️ **注意**: インフルエンサーアカウントを削除すると、関連する Talk 枠も削除される可能性があります。

## 📝 承認基準（推奨）

以下の基準を満たすユーザーを承認することを推奨します：

1. **本人確認が完了している**
2. **信頼できるメールアドレスで登録**
3. **SNS アカウントが実在する**
4. **規約に同意している**
5. **過去に問題行動がない**

## 🔍 審査プロセス（例）

1. ユーザーから申請を受け付け
2. プロフィール情報を確認
3. SNS アカウントの実在確認
4. 本人確認書類の提出（必要に応じて）
5. 承認/却下の決定
6. データベースでフラグを更新
7. ユーザーに通知（メール等）

## 📧 通知テンプレート（例）

### 承認通知

```
件名: OshiTalk インフルエンサー承認のお知らせ

{ユーザー名} 様

この度は、OshiTalkのインフルエンサーにご応募いただき、
誠にありがとうございます。

審査の結果、インフルエンサーとしての活動を承認いたしました。

ログイン後、ユーザーメニューから「インフルエンサーになる」を
クリックすることで、インフルエンサー機能をご利用いただけます。

今後ともOshiTalkをよろしくお願いいたします。

OshiTalk運営チーム
```

### 却下通知

```
件名: OshiTalk インフルエンサー申請について

{ユーザー名} 様

この度は、OshiTalkのインフルエンサーにご応募いただき、
誠にありがとうございます。

審査の結果、現時点では承認を見送らせていただくこととなりました。

改めてご応募いただく際は、以下の点についてご確認ください：
- プロフィール情報の充実
- SNSアカウントの実在確認
- 本人確認書類の提出

ご不明な点がございましたら、お気軽にお問い合わせください。

OshiTalk運営チーム
```

## 🆘 トラブルシューティング

### Q: 承認したのにボタンが表示されない

A: ユーザーがログアウト → ログインして、最新の情報を取得してください。

### Q: インフルエンサーになったユーザーを元に戻したい

A: `influencers` テーブルからレコードを削除してください。`can_be_influencer` フラグは残しておくことで、再度インフルエンサーになることができます。

### Q: 一括で複数のユーザーを承認したい

A: 以下のようなクエリを使用:

```sql
UPDATE fans
SET can_be_influencer = TRUE
WHERE auth_user_id IN (
  SELECT id FROM auth.users
  WHERE email IN (
    'user1@example.com',
    'user2@example.com',
    'user3@example.com'
  )
);
```

## 📈 統計・分析

### 承認率

```sql
SELECT
  COUNT(*) FILTER (WHERE can_be_influencer = TRUE) as 承認済み,
  COUNT(*) as 全ファン,
  ROUND(COUNT(*) FILTER (WHERE can_be_influencer = TRUE)::numeric / COUNT(*) * 100, 2) as 承認率
FROM fans;
```

### インフルエンサー活動率

```sql
SELECT
  COUNT(DISTINCT f.id) as 承認済みユーザー数,
  COUNT(DISTINCT i.id) as 活動中インフルエンサー数,
  ROUND(COUNT(DISTINCT i.id)::numeric / COUNT(DISTINCT f.id) * 100, 2) as 活動率
FROM fans f
LEFT JOIN influencers i ON f.auth_user_id = i.auth_user_id
WHERE f.can_be_influencer = TRUE;
```

---

## 📞 サポート

このガイドについてご不明な点がある場合は、開発チームまでお問い合わせください。
