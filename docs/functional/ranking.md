# ランキング機能

## 対応する業務仕様

- [/docs/business/user-management.md](../business/user-management.md) - ランキング関連

## 概要
インフルエンサーや Talk枠の人気ランキングを表示する機能。ユーザーが人気のインフルエンサーやTalkを発見しやすくする。

## 機能詳細

### 1. インフルエンサーランキング
**実装ファイル**: `src/pages/Rankings.tsx`

**ランキング基準** (優先度順):
1. **総売上ランキング** - `total_earned` の降順
2. **完了Talk数ランキング** - `total_calls_completed` の降順
3. **平均評価ランキング** - `average_rating` の降順
4. **フォロワー数ランキング** - `follower_count` の降順

**現在の実装**: 総売上ランキングのみ

**データ取得**:
```typescript
const { data: topInfluencers } = await supabase
  .from('users')
  .select('*')
  .order('total_earned', { ascending: false })
  .limit(10);
```

**表示内容**:
- 順位（1位、2位、3位は特別デザイン）
- プロフィール画像
- インフルエンサー名
- 総売上額
- 完了Talk数
- 平均評価
- フォロワー数

**ランキングバッジ**:
- 1位: 🥇 金メダル
- 2位: 🥈 銀メダル
- 3位: 🥉 銅メダル
- 4位以降: 順位番号

### 2. Talk枠人気ランキング（将来実装）
**ランキング基準**:
1. **入札数ランキング** - 入札が多いTalk枠
2. **最高入札額ランキング** - 最終価格が高いTalk枠
3. **閲覧数ランキング** - 閲覧回数が多いTalk枠

**データ取得例**:
```sql
-- 入札数ランキング
SELECT
  cs.*,
  COUNT(b.id) as bid_count,
  a.current_highest_bid
FROM call_slots cs
JOIN auctions a ON cs.id = a.call_slot_id
LEFT JOIN bids b ON a.id = b.auction_id
WHERE a.status = 'active'
GROUP BY cs.id, a.id
ORDER BY bid_count DESC
LIMIT 10;
```

### 3. 新着Talk枠（実装済み）
**実装ファイル**: `src/pages/Rankings.tsx`

**データ取得**:
```typescript
const { data: recentTalks } = await supabase
  .from('active_auctions_view')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(10);
```

**表示内容**:
- サムネイル画像
- Talk枠タイトル
- インフルエンサー名
- 現在の最高入札額
- オークション終了までの時間

### 4. ランキング期間フィルター（将来実装）
**期間選択**:
- 週間ランキング（過去7日間）
- 月間ランキング（過去30日間）
- 年間ランキング（過去365日間）
- 全期間ランキング

**実装例**:
```typescript
const startDate = new Date();
startDate.setDate(startDate.getDate() - 7); // 過去7日間

const { data } = await supabase
  .from('purchased_slots')
  .select('user_id, SUM(final_price) as total')
  .gte('purchased_at', startDate.toISOString())
  .group('user_id')
  .order('total', { ascending: false });
```

## データ構造

### users テーブル（ランキング関連）
```sql
ALTER TABLE users ADD COLUMN total_earned INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN total_calls_completed INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN average_rating DECIMAL(3,2) DEFAULT 0;
ALTER TABLE users ADD COLUMN follower_count INTEGER DEFAULT 0;
```

**更新タイミング**:
- `total_earned`: Talk完了時に加算
- `total_calls_completed`: Talk完了時にインクリメント
- `average_rating`: レビュー投稿時に再計算
- `follower_count`: フォロー/アンフォロー時に更新

### ランキングキャッシュテーブル（将来実装）
```sql
CREATE TABLE ranking_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ranking_type TEXT NOT NULL, -- 'total_earned', 'total_calls', etc.
  period TEXT NOT NULL, -- 'weekly', 'monthly', 'yearly', 'all_time'
  user_id UUID REFERENCES users(id),
  rank INTEGER NOT NULL,
  score DECIMAL,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ranking_type, period, user_id)
);

-- インデックス
CREATE INDEX idx_ranking_cache_type_period
  ON ranking_cache(ranking_type, period, rank);
```

**利点**:
- 集計処理の高速化
- リアルタイムランキング不要な場合はキャッシュ使用
- 定期的にバッチ処理で更新

## UI/UX

### ランキングページレイアウト
**タブ構成**:
- インフルエンサーランキング
- 新着Talk枠
- 人気Talk枠（将来実装）

### ランキングカード
**トップ3の特別デザイン**:
```tsx
<div className={`p-6 rounded-xl ${
  rank === 1 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
  rank === 2 ? 'bg-gradient-to-r from-gray-300 to-gray-400' :
  rank === 3 ? 'bg-gradient-to-r from-orange-400 to-orange-600' :
  'bg-white'
}`}>
  <div className="text-4xl">
    {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
  </div>
  {/* インフルエンサー情報 */}
</div>
```

### ランキング数値表示
```tsx
<div className="space-y-2">
  <div className="flex items-center">
    <DollarSign className="h-4 w-4 mr-1" />
    <span>¥{formatPrice(influencer.total_earned)}</span>
  </div>
  <div className="flex items-center">
    <Video className="h-4 w-4 mr-1" />
    <span>{influencer.total_calls_completed}回</span>
  </div>
  <div className="flex items-center">
    <Star className="h-4 w-4 mr-1 text-yellow-500" />
    <span>{influencer.average_rating.toFixed(1)}</span>
  </div>
</div>
```

## エラーハンドリング

### データ取得エラー
- ネットワークエラー: `ランキング情報の取得に失敗しました`
- タイムアウト: 再試行ボタン表示

### データ不足
- ランキングデータなし: `まだランキングデータがありません`
- プレースホルダー表示

## パフォーマンス最適化

### クエリ最適化
- インデックス活用
- 必要なフィールドのみSELECT
- LIMIT で取得数制限

### キャッシング
- ランキングデータをメモリキャッシュ（将来実装）
- 更新頻度: 5分ごと
- Redis使用（将来実装）

### バッチ処理
- 定期的にランキング集計
- Supabase Cron Jobで実行
- 深夜など負荷の少ない時間帯に実行

## 集計処理

### 統計情報更新
**実装ファイル**: `supabase/functions/update-user-stats/index.ts`

**処理内容**:
```typescript
// 1. 総売上の集計
UPDATE users
SET total_earned = (
  SELECT COALESCE(SUM(ps.final_price), 0)
  FROM purchased_slots ps
  JOIN call_slots cs ON ps.call_slot_id = cs.id
  WHERE cs.user_id = users.id
);

// 2. 完了Talk数の集計
UPDATE users
SET total_calls_completed = (
  SELECT COUNT(*)
  FROM purchased_slots ps
  JOIN call_slots cs ON ps.call_slot_id = cs.id
  WHERE cs.user_id = users.id
    AND ps.call_status = 'completed'
);

// 3. 平均評価の集計（将来実装）
UPDATE users
SET average_rating = (
  SELECT COALESCE(AVG(rating), 0)
  FROM reviews r
  WHERE r.influencer_id = users.id
);
```

**実行頻度**: 1日1回（深夜）

### リアルタイム更新（将来実装）
Supabase Triggers使用:
```sql
-- Talk完了時にtotal_calls_completedをインクリメント
CREATE OR REPLACE FUNCTION update_influencer_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.call_status = 'completed' AND OLD.call_status != 'completed' THEN
    UPDATE users
    SET
      total_calls_completed = total_calls_completed + 1,
      total_earned = total_earned + NEW.final_price
    WHERE id = (
      SELECT user_id FROM call_slots WHERE id = NEW.call_slot_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stats_on_call_complete
AFTER UPDATE ON purchased_slots
FOR EACH ROW
EXECUTE FUNCTION update_influencer_stats();
```

## セキュリティ

### RLS (Row Level Security)
- ランキングデータは全員閲覧可能
- 統計情報テーブルは読み取り専用

### データ整合性
- 統計情報の定期検証
- 異常値の検出とアラート

## 分析・レポート（将来実装）

### ランキング推移
- 順位の変動グラフ
- 前週比・前月比表示
- ランキング履歴の保存

### インサイト
- 急上昇インフルエンサー
- 注目のTalk枠
- トレンド分析

### エクスポート機能
- CSV出力
- PDF レポート生成
- メール配信
