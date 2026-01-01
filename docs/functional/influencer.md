# インフルエンサー管理機能

## 対応する業務仕様

- [/docs/business/user-management.md](../business/user-management.md) - インフルエンサー管理関連

## 概要
インフルエンサーがTalk枠を作成・管理し、売上を確認できる機能。

## 機能詳細

### 1. インフルエンサーダッシュボード
**実装ファイル**: `src/pages/InfluencerDashboard.tsx`

**アクセス**: `/influencer-dashboard`

**表示内容**:
- 作成したTalk枠一覧
- 各Talk枠のステータス（オークション中/終了）
- オークション終了までの残り時間
- 現在の最高入札額
- Talk枠作成ボタン

**データ取得**:
```typescript
const { data: callSlots } = await supabase
  .from('call_slots')
  .select(`
    *,
    auctions(
      id, status, current_highest_bid,
      end_time, current_winner_id
    )
  `)
  .eq('user_id', userId)
  .order('scheduled_start_time', { ascending: false });
```

### 2. Talk枠作成フォーム
**コンポーネント**: `src/components/CreateCallSlotForm.tsx`

**入力項目**:
- タイトル (必須)
- 説明 (必須)
- 通話開始予定時刻 (必須、未来の日時)
- 通話時間 (デフォルト: 30分)
- サムネイル画像 (任意)
- オークション開始価格 (デフォルト: 1,000円)
- 即決価格 (任意)

**バリデーション**:
```typescript
// タイトル
title.length > 0

// 説明
description.length > 0

// 通話開始時刻
new Date(scheduled_start_time) > new Date()

// 通話時間
duration_minutes >= 5

// 開始価格
starting_price >= 100

// 即決価格（設定する場合）
buy_now_price > starting_price
```

**画像アップロード**:
```typescript
const { data, error } = await supabase.storage
  .from('talk-thumbnails')
  .upload(`${userId}/${fileName}`, file);

const { data: { publicUrl } } = supabase.storage
  .from('talk-thumbnails')
  .getPublicUrl(data.path);
```

**作成処理**:
```typescript
// 1. call_slots作成
const { data: callSlot, error } = await supabase
  .from('call_slots')
  .insert({
    user_id: userId,
    title, description,
    scheduled_start_time,
    duration_minutes,
    starting_price,
    buy_now_price,
    thumbnail_url
  })
  .select()
  .single();

// 2. auction作成（自動）
// オークション終了時刻 = 通話開始時刻の1時間前
const auction_end_time = new Date(
  new Date(scheduled_start_time).getTime() - 60 * 60 * 1000
);

const { error: auctionError } = await supabase
  .from('auctions')
  .insert({
    call_slot_id: callSlot.id,
    starting_price,
    buy_now_price,
    start_time: new Date(),
    end_time: auction_end_time
  });
```

### 3. Talk枠編集
**実装状況**: 将来実装予定

**機能**:
- タイトル・説明の修正
- 画像の変更
- 通話時刻の変更（オークション開始前のみ）

**制限**:
- オークション開始後は編集不可
- 入札がある場合は価格変更不可

### 4. Talk枠削除
**実装状況**: 将来実装予定

**制限**:
- 入札がない場合のみ削除可能
- オークション開始後は削除不可

### 5. 売上管理
**実装ファイル**: `src/pages/InfluencerDashboard.tsx`

**表示内容**:
- 総売上額
- 完了したTalk件数
- 平均評価（将来実装）
- 月別売上グラフ（将来実装）

**データ取得**:
```typescript
// 総売上額
const { data: sales } = await supabase
  .from('purchased_slots')
  .select('final_price')
  .eq('call_slot_id', 'IN (
    SELECT id FROM call_slots WHERE user_id = $1
  )');

const totalEarnings = sales.reduce(
  (sum, s) => sum + s.final_price, 0
);

// 完了したTalk件数
const { count } = await supabase
  .from('purchased_slots')
  .select('*', { count: 'exact' })
  .eq('call_status', 'completed')
  .eq('call_slot_id', 'IN (...)');
```

### 6. スケジュール管理
**実装ファイル**: `src/pages/InfluencerDashboard.tsx`

**表示内容**:
- 予定されているTalk一覧
- 日時順ソート
- ステータス表示（upcoming/ready/in_progress/completed）

**カレンダービュー**: 将来実装予定

## インフルエンサーページ

### インフルエンサー詳細ページ
**実装ファイル**: `src/pages/InfluencerPage.tsx`

**URL**: `/i/{influencer_id}`

**表示内容**:
- インフルエンサー情報（名前、画像、自己紹介）
- フォローボタン
- 統計情報（完了Talk数、平均評価）
- 開催中のTalk枠一覧
- 過去のTalk枠（将来実装）

**データ取得**:
```typescript
// インフルエンサー情報
const { data: influencer } = await supabase
  .from('users')
  .select('*')
  .eq('id', influencerId)
  .single();

// Talk枠一覧
const { data: talks } = await supabase
  .from('active_auctions_view')
  .select('*')
  .eq('influencer_id', influencerId);
```

## データ構造

### call_slots テーブル
```sql
CREATE TABLE call_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  scheduled_start_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  starting_price INTEGER NOT NULL DEFAULT 1000,
  buy_now_price INTEGER,
  thumbnail_url TEXT,
  is_female_only BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_call_slots_user_id ON call_slots(user_id);
CREATE INDEX idx_call_slots_scheduled_start_time
  ON call_slots(scheduled_start_time);
```

## UI/UX

### ダッシュボードレイアウト
- サイドバー: 統計情報
- メインエリア: Talk枠一覧
- ヘッダー: Talk枠作成ボタン

### Talk枠カード（ダッシュボード）
- サムネイル画像
- タイトル
- 通話予定時刻
- オークション終了時刻
- 現在の最高入札額
- ステータスバッジ

### Talk枠作成フォーム
- ステップ形式（将来実装）
- リアルタイムバリデーション
- プレビュー表示（将来実装）

## エラーハンドリング

### Talk枠作成エラー
- 必須項目未入力: フィールドごとにエラー表示
- 日時が過去: `未来の日時を選択してください`
- 画像アップロード失敗: `画像のアップロードに失敗しました`
- DB保存失敗: `Talk枠の作成に失敗しました`

### 権限エラー
- 他人のTalk枠編集: 403エラー
- アクセス拒否

## セキュリティ

### RLS (Row Level Security)
```sql
-- 自分のTalk枠のみ更新可能
CREATE POLICY "Users can update own call slots"
ON call_slots
FOR UPDATE
USING (auth.uid() = user_id);

-- 自分のTalk枠のみ削除可能
CREATE POLICY "Users can delete own call slots"
ON call_slots
FOR DELETE
USING (auth.uid() = user_id);

-- 全員が閲覧可能
CREATE POLICY "Anyone can view call slots"
ON call_slots
FOR SELECT
USING (true);
```

### バリデーション
- サーバーサイドバリデーション
- XSS対策（入力サニタイズ）
- 価格の妥当性チェック

## パフォーマンス最適化

### 画像最適化
- サムネイル画像: 最大1MB
- 圧縮推奨
- WebP形式推奨

### データ取得最適化
- JOINを使った一括取得
- ページネーション（将来実装）
- キャッシング（将来実装）

## 将来実装予定機能

### カレンダービュー
- 月別カレンダー表示
- Talk枠の予定一覧
- ドラッグ&ドロップで日時変更

### レビュー管理
- Talk後のレビュー閲覧
- 平均評価の確認
- レビューへの返信

### 売上分析
- 月別売上グラフ
- Talk枠ごとの売上分析
- 人気時間帯分析

### 通知機能
- オークション終了通知
- Talk開始時刻通知
- 新規フォロワー通知
