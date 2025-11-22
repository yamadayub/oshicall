# フォロー機能セットアップガイド

このガイドでは、インフルエンサーのフォロー機能と新規Talk枠通知機能のセットアップ方法を説明します。

## 機能概要

### 1. **フォロー機能**
- Fanユーザーがインフルエンサーをフォローできる
- TalkCardにハートボタンを表示
- フォロー/アンフォローの切り替え
- フォロー状態のリアルタイム表示

### 2. **新規Talk枠通知**
- フォロー中のインフルエンサーが新しいTalk枠を公開したらメール通知
- 美しいHTMLメールテンプレート
- Talk詳細（日時、価格、説明など）を含む

### 3. **優先表示**
- Topページでフォロー中のインフルエンサーのTalk枠が上部に表示
- フォロー中の枠数を表示

## データベースセットアップ

### 1. マイグレーションの実行

Supabase SQLエディタで以下のマイグレーションを実行:

```bash
supabase/migrations/create_follows_table.sql
```

このマイグレーションは以下を作成します:
- `follows` テーブル
- 必要なインデックス
- RLSポリシー
- ヘルパー関数とビュー

### 2. テーブル構造

```sql
CREATE TABLE follows (
  id UUID PRIMARY KEY,
  follower_id UUID REFERENCES users(id),
  following_id UUID REFERENCES users(id),
  created_at TIMESTAMP,
  UNIQUE(follower_id, following_id)
);
```

### 3. 関数とビュー

- `get_follow_counts(user_id)`: フォロワー数とフォロー中の数を取得
- `is_following(follower_id, following_id)`: フォロー状態を確認
- `user_followers`: フォロワーリストビュー
- `user_following`: フォロー中リストビュー

## Edge Function セットアップ

### 1. 環境変数の設定

Supabase Dashboard → Project Settings → Edge Functions で設定:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxx
FROM_EMAIL=OshiTalk <noreply@oshicall.com>
APP_URL=https://oshicall-2936440db16b.herokuapp.com
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2. Edge Functionのデプロイ

```bash
# 新規Talk枠通知機能をデプロイ
supabase functions deploy notify-new-talk-slot

# デプロイ確認
supabase functions list
```

### 3. Database Webhookの設定

Supabase Dashboard → Database → Webhooks で新規Webhookを作成:

- **Name**: `notify-new-talk-slot`
- **Table**: `call_slots`
- **Events**: `INSERT`
- **Type**: `HTTP Request`
- **Method**: `POST`
- **URL**: `https://your-project.supabase.co/functions/v1/notify-new-talk-slot`
- **HTTP Headers**:
  ```
  Authorization: Bearer YOUR_ANON_KEY
  Content-Type: application/json
  ```

### 4. Webhook Conditions (Optional)

公開されたTalk枠のみ通知する場合:

```sql
NEW.is_published = true
```

## フロントエンド実装

### 1. 主要コンポーネント

#### TalkCard
- フォローボタンの表示
- フォロー/アンフォローの切り替え
- ハートアイコンのアニメーション

```tsx
<TalkCard
  talk={talk}
  onSelect={handleTalkSelect}
  isFollowing={isFollowing}
  onFollowChange={handleFollowChange}
/>
```

#### Home Page
- フォロー中のインフルエンサーを優先表示
- フォロー中の枠数を表示

### 2. API関数

```tsx
import {
  followInfluencer,
  unfollowInfluencer,
  checkFollowStatus,
  getFollowCounts,
  getFollowingInfluencerIds
} from '../api/follows';
```

### 3. 使用例

```tsx
// フォローする
await followInfluencer(fanId, influencerId);

// アンフォローする
await unfollowInfluencer(fanId, influencerId);

// フォロー状態を確認
const isFollowing = await checkFollowStatus(fanId, influencerId);

// フォロー数を取得
const { followers_count, following_count } = await getFollowCounts(userId);

// フォロー中のインフルエンサーIDリストを取得
const followingIds = await getFollowingInfluencerIds(fanId);
```

## メール通知の仕組み

### 1. トリガー

1. インフルエンサーが新しいTalk枠を作成
2. `call_slots` テーブルに `INSERT` イベント発生
3. Database Webhookが `notify-new-talk-slot` Edge Functionを呼び出し
4. Edge Functionがフォロワーを取得してメール送信

### 2. メールテンプレート

- HTMLとプレーンテキスト両対応
- レスポンシブデザイン
- Talk詳細情報を含む
- CTAボタン（詳細ページへのリンク）

### 3. 送信条件

- Talk枠が公開状態 (`is_published = true`)
- インフルエンサーにフォロワーが存在
- フォロワーのメールアドレスが登録済み

## テスト手順

### 1. フォロー機能のテスト

1. Fanユーザーでログイン
2. Topページでインフルエンサーのカードを表示
3. ハートボタンをクリックしてフォロー
4. ボタンがピンク色に変わることを確認
5. 再度クリックしてアンフォロー

### 2. 優先表示のテスト

1. 複数のインフルエンサーをフォロー
2. Topページをリロード
3. フォロー中のインフルエンサーのTalk枠が上部に表示されることを確認
4. フォロー中の枠数が表示されることを確認

### 3. メール通知のテスト

1. インフルエンサーでログイン
2. 新しいTalk枠を作成（公開状態で）
3. フォロワーのメールアドレスに通知が届くことを確認
4. Resendダッシュボードで送信ログを確認

### 4. Edge Functionログの確認

```bash
# リアルタイムログ
supabase functions logs notify-new-talk-slot --tail

# 特定期間のログ
supabase functions logs notify-new-talk-slot --since "2024-01-01"
```

## トラブルシューティング

### フォローボタンが表示されない

1. ログイン状態を確認
2. 自分のカードではフォローボタンは表示されない
3. ブラウザのコンソールでエラーを確認

### メールが届かない

1. **Webhook設定を確認**
   - Database → Webhooks でステータスを確認
   - テストリクエストを送信

2. **Edge Function ログを確認**
   ```bash
   supabase functions logs notify-new-talk-slot
   ```

3. **Resend ダッシュボードを確認**
   - Logs で送信履歴を確認
   - エラーメッセージを確認

4. **環境変数を確認**
   ```bash
   supabase secrets list
   ```

### フォロー中のTalk枠が優先表示されない

1. フォロー状態を確認
2. ブラウザのコンソールで`followingInfluencerIds`を確認
3. キャッシュをクリアしてリロード

## セキュリティ

### RLS (Row Level Security)

- ✅ フォロー情報は全ログインユーザーが閲覧可能
- ✅ フォロー作成は本人のみ可能
- ✅ フォロー削除は本人のみ可能
- ✅ 自分自身のフォローは禁止

### API セキュリティ

- ✅ Supabase RLSで保護
- ✅ Webhookは認証トークンで保護
- ✅ Edge Functionはservice roleキーを使用

## パフォーマンス最適化

### インデックス

- `follower_id` にインデックス
- `following_id` にインデックス
- `created_at` にインデックス（降順）

### クエリ最適化

- フォロー状態の一括チェック (`checkMultipleFollowStatus`)
- ビューを使用してJOINを最適化
- フォロー中のIDリストをキャッシュ

## 今後の拡張案

### 1. フォロワー管理画面
- フォロワーリストの表示
- フォロー中リストの表示
- フォロー解除

### 2. 通知設定
- メール通知のON/OFF
- 通知頻度の設定
- 通知対象の絞り込み

### 3. フォロー推奨
- 人気インフルエンサーの表示
- フォロー数に基づくランキング
- おすすめインフルエンサー

### 4. ソーシャル機能
- フォロワー同士の交流
- フォローバッジの表示
- 相互フォロー表示

## サポート

問題が解決しない場合:
- Supabase公式ドキュメント: https://supabase.com/docs
- Resend公式ドキュメント: https://resend.com/docs
- プロジェクトのIssueトラッカー
