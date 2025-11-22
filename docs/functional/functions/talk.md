# Talk（通話）機能 要件定義

## 概要
インフルエンサーとファンの1対1ビデオ通話を実現する機能。

## 機能詳細

### 1. Talk枠作成
**実装ファイル**: `src/components/CreateCallSlotForm.tsx`

**権限**: インフルエンサーのみ

**入力項目**:
- `title` - Talk枠のタイトル
- `description` - Talk枠の説明
- `scheduled_start_time` - 通話開始予定時刻
- `duration_minutes` - 通話時間（分）
- `starting_price` - オークション開始価格（円）
- `buy_now_price` - 即決価格（円、任意）
- `thumbnail_url` - サムネイル画像URL
- `is_female_only` - 女性限定フラグ（将来実装）

**デフォルト値**:
- `duration_minutes`: 30分
- `starting_price`: 1,000円
- `buy_now_price`: なし

**バリデーション**:
- タイトル: 必須、1文字以上
- 説明: 必須
- 通話開始時刻: 未来の日時
- 通話時間: 5分以上
- 開始価格: 100円以上
- 即決価格: 開始価格より高い（設定する場合）

**処理フロー**:
1. フォーム入力
2. サムネイル画像アップロード（Supabase Storage）
3. `call_slots`テーブルにレコード作成
4. `auctions`テーブルにレコード作成（自動）
5. インフルエンサーダッシュボードへリダイレクト

**API**: `POST /api/call-slots` (Supabase直接操作)

### 2. Talk枠一覧表示
**実装ファイル**: `src/pages/Home.tsx`

**データソース**: `active_auctions_view`

**表示順序**（優先度順）:
1. オークション開催中（active） > 終了済み（ended）
2. フォロー中のインフルエンサー > 未フォロー
3. オークション終了時刻が近い順

**ソートロジック**:
```typescript
const sortedTalks = [...filteredTalks].sort((a, b) => {
  // 1. オークション開催中を優先
  const aIsActive = a.auction_status === 'active';
  const bIsActive = b.auction_status === 'active';
  if (aIsActive && !bIsActive) return -1;
  if (!aIsActive && bIsActive) return 1;

  // 2. フォロー中を優先
  const aIsFollowing = followingInfluencerIds.has(a.influencer_id);
  const bIsFollowing = followingInfluencerIds.has(b.influencer_id);
  if (aIsFollowing && !bIsFollowing) return -1;
  if (!aIsFollowing && bIsFollowing) return 1;

  // 3. 終了時刻が近い順
  return new Date(a.auction_end_time).getTime() - new Date(b.auction_end_time).getTime();
});
```

**表示内容**:
- サムネイル画像
- インフルエンサー名・アバター
- Talk枠タイトル
- 現在の最高入札額
- オークション終了までのカウントダウン
- フォロー中バッジ（該当する場合）

**コンポーネント**: `src/components/TalkCard.tsx`

### 3. Talk枠詳細表示
**実装ファイル**: `src/pages/TalkDetail.tsx`

**表示内容**:
- 背景画像（detail_image_url）
- インフルエンサー情報（名前、アバター、プロフィール）
- Talk予定時間
- ホストメッセージ
- 現在の最高入札額
- 入札ボタン
- 即決購入ボタン（設定がある場合）
- カウントダウンタイマー
- 入札履歴リンク

**データ取得**:
```sql
SELECT
  a.id, a.status, a.current_highest_bid, a.current_winner_id,
  cs.id, cs.title, cs.description, cs.scheduled_start_time,
  cs.duration_minutes, cs.starting_price, cs.buy_now_price,
  cs.thumbnail_url,
  u.id, u.display_name, u.bio, u.profile_image_url,
  u.total_calls_completed, u.average_rating
FROM auctions a
JOIN call_slots cs ON a.call_slot_id = cs.id
JOIN users u ON cs.user_id = u.id
WHERE cs.id = $1;
```

### 4. 購入済みTalk一覧
**実装ファイル**: `src/pages/MyPage.tsx` (Talksタブ)

**表示内容**:
- 落札したTalk枠の一覧
- Talk予定時刻
- インフルエンサー情報
- 通話ステータス

**ステータス**:
- `upcoming` - 予定時刻前
- `ready` - 通話可能時間（予定時刻の前後30分）
- `completed` - 通話完了

**データソース**: `purchased_slots`

```sql
SELECT
  ps.*,
  cs.title, cs.scheduled_start_time, cs.duration_minutes,
  u.display_name, u.profile_image_url
FROM purchased_slots ps
JOIN call_slots cs ON ps.call_slot_id = cs.id
JOIN users u ON cs.user_id = u.id
WHERE ps.user_id = $1
ORDER BY cs.scheduled_start_time DESC;
```

### 5. ビデオ通話実施
**実装ファイル**: `src/pages/CallPage.tsx`

**アクセス条件**:
- 購入済みTalk枠である
- 予定時刻の前後30分以内
- 通話ステータスが`completed`でない

**通話機能**:
- WebRTC（将来実装予定）
- 現在: プレースホルダー画面のみ

**URL**: `/call/{purchased_slot_id}`

**終了処理**:
- 通話時間が経過したら自動的に終了
- `call_status`を`completed`に更新

## データ構造

### call_slots テーブル
```sql
CREATE TABLE call_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id), -- インフルエンサー
  title TEXT NOT NULL,
  description TEXT,
  scheduled_start_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  starting_price INTEGER NOT NULL DEFAULT 1000,
  buy_now_price INTEGER,
  thumbnail_url TEXT,
  is_female_only BOOLEAN DEFAULT FALSE,
  end_time TIMESTAMPTZ NOT NULL, -- scheduled_start_time + duration_minutes（自動計算）
  status call_slot_status DEFAULT 'planned', -- planned, live, completed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**call_slot_status enum**:
```sql
CREATE TYPE call_slot_status AS ENUM ('planned', 'live', 'completed');
```

**自動処理**:
- `end_time`: `scheduled_start_time` + `duration_minutes`で自動計算
- `status`: 作成時は`planned`、purchased_slots作成で`live`、call完了で`completed`

### purchased_slots テーブル
```sql
CREATE TABLE purchased_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_slot_id UUID NOT NULL REFERENCES call_slots(id),
  user_id UUID NOT NULL REFERENCES users(id), -- 購入者
  auction_id UUID REFERENCES auctions(id),
  final_price INTEGER NOT NULL,
  purchase_type TEXT NOT NULL, -- 'auction' or 'buy_now'
  call_status TEXT DEFAULT 'upcoming', -- 'upcoming', 'ready', 'in_progress', 'completed'
  stripe_payment_intent_id TEXT,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  call_started_at TIMESTAMPTZ,
  call_ended_at TIMESTAMPTZ
);
```

## UI/UX

### Talk枠カード (TalkCard.tsx)
- ホバー時: 影が濃くなる、スケールアップ
- クリック: 詳細ページへ遷移
- サムネイル画像の上にカウントダウン表示

### Talk詳細ページ (TalkDetail.tsx)
- フルスクリーン背景画像
- 下部に入札エリア（半透明背景）
- インフルエンサー名クリック → インフルエンサーページへ
- シェアボタン → URLコピー

### 購入済みTalk一覧
- 予定時刻順（新しい順）
- ステータスバッジ（upcoming/ready/completed）
- 通話開始ボタン（ready状態の場合のみ）

## 時刻表示ルール

### タイムゾーン
- 全て日本時間（Asia/Tokyo）で表示

### フォーマット
```typescript
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};
```

### 表示例
- `2025/01/15 14:30` - Talk開始時刻
- `14:30 - 15:00` - Talk時間範囲（30分間）

## エラーハンドリング

### Talk枠作成エラー
- 画像アップロード失敗: エラーメッセージ表示、再試行
- バリデーションエラー: フィールドごとにエラー表示
- DB保存失敗: エラーメッセージ、フォーム内容保持

### Talk枠が見つからない
- 詳細ページで404エラー
- ホームに戻るボタン表示

### 通話アクセスエラー
- 権限なし: マイページへリダイレクト
- 時間外アクセス: エラーメッセージ表示

## パフォーマンス最適化

### 画像最適化
- サムネイル画像: 最大サイズ制限（1MB）
- Lazy Loading使用
- WebP形式推奨

### データ取得最適化
- ビューを使った事前JOIN
- ページネーション（将来実装）
- キャッシング（将来実装）

## セキュリティ

### アクセス制御
- Talk枠作成: インフルエンサーのみ
- 通話ページ: 購入者のみアクセス可能
- RLS (Row Level Security) 使用

### データ検証
- サーバーサイドバリデーション
- XSS対策（入力サニタイズ）
- CSRF対策（トークン検証）
