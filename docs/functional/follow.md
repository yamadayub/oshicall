# フォロー機能

## 対応する業務仕様

- [/docs/business/user-management.md](../business/user-management.md) - フォロー関連

## 概要
ユーザーがお気に入りのインフルエンサーをフォローし、フォロー中のインフルエンサーのTalk枠を優先的に表示する機能。

## 機能詳細

### 1. フォロー / アンフォロー
**実装ファイル**: `src/api/follows.ts`, `src/pages/InfluencerPage.tsx`

**フォローボタン配置場所**:
- インフルエンサーページ (`/i/{influencer_id}`)
- Talk詳細ページのインフルエンサー名横（将来実装）

**フロー**:
```typescript
// フォロー
const handleFollow = async () => {
  const { error } = await supabase
    .from('follows')
    .insert({
      follower_id: currentUserId,
      followed_id: influencerId
    });

  if (!error) {
    // フォロー数を更新（リアルタイム）
    setIsFollowing(true);
  }
};

// アンフォロー
const handleUnfollow = async () => {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', currentUserId)
    .eq('followed_id', influencerId);

  if (!error) {
    setIsFollowing(false);
  }
};
```

### 2. フォロー状態の確認
**実装ファイル**: `src/api/follows.ts`

**API関数**:
```typescript
export const checkIsFollowing = async (
  followerId: string,
  followedId: string
): Promise<boolean> => {
  const { data, error } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('followed_id', followedId)
    .single();

  return !!data;
};
```

### 3. フォロー中のインフルエンサー一覧取得
**実装ファイル**: `src/api/follows.ts`

**使用箇所**: Topページのソート処理

**API関数**:
```typescript
export const getFollowingInfluencerIds = async (
  userId: string
): Promise<string[]> => {
  const { data, error } = await supabase
    .from('follows')
    .select('followed_id')
    .eq('follower_id', userId);

  return data?.map(f => f.followed_id) || [];
};
```

### 4. フォロワー数表示
**実装ファイル**: `src/pages/InfluencerPage.tsx`

**表示場所**:
- インフルエンサーページ
- ランキングページ（将来実装）

**取得方法**:
```typescript
const { count: followerCount } = await supabase
  .from('follows')
  .select('*', { count: 'exact', head: true })
  .eq('followed_id', influencerId);
```

### 5. フォロー中のTalk枠優先表示
**実装ファイル**: `src/pages/Home.tsx`

**ソートロジック**:
```typescript
const sortedTalks = [...filteredTalks].sort((a, b) => {
  const aIsActive = a.auction_status === 'active';
  const bIsActive = b.auction_status === 'active';
  const aIsFollowing = followingInfluencerIds.has(a.influencer_id);
  const bIsFollowing = followingInfluencerIds.has(b.influencer_id);

  // 1. オークション開催中を優先
  if (aIsActive && !bIsActive) return -1;
  if (!aIsActive && bIsActive) return 1;

  // 2. フォロー中のインフルエンサーを優先
  if (aIsFollowing && !bIsFollowing) return -1;
  if (!aIsFollowing && bIsFollowing) return 1;

  // 3. オークション終了時刻が近い順
  return new Date(a.auction_end_time).getTime() -
         new Date(b.auction_end_time).getTime();
});
```

**表示内容**:
- フォロー中のバッジ表示（将来実装）
- フォロー中のTalk枠カウント表示

```typescript
<p className="text-purple-600">
  （フォロー中: {
    sortedTalks.filter(
      t => followingInfluencerIds.has(t.influencer_id)
    ).length
  }件）
</p>
```

### 6. フォロー一覧ページ
**実装状況**: 将来実装予定

**URL**: `/mypage?tab=following`

**表示内容**:
- フォロー中のインフルエンサー一覧
- 各インフルエンサーの最新Talk枠
- アンフォローボタン

## データ構造

### follows テーブル
```sql
CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followed_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, followed_id),
  CHECK (follower_id != followed_id)
);

-- インデックス
CREATE INDEX idx_follows_follower_id ON follows(follower_id);
CREATE INDEX idx_follows_followed_id ON follows(followed_id);

-- 複合インデックス（フォロー状態確認用）
CREATE INDEX idx_follows_follower_followed
  ON follows(follower_id, followed_id);
```

**制約**:
- `follower_id` と `followed_id` の組み合わせは一意
- 自分自身をフォローできない (`CHECK` 制約)
- ユーザー削除時に自動削除 (`ON DELETE CASCADE`)

### users テーブル（フォロー関連）
```sql
-- 統計情報（集計ビューで算出）
ALTER TABLE users ADD COLUMN follower_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN following_count INTEGER DEFAULT 0;
```

**更新方法**（将来実装）:
- フォロー/アンフォロー時にトリガーで更新
- または定期的にバッチ処理で集計

## UI/UX

### フォローボタン
**デザイン**:
- フォロー前: ピンク色ボタン「フォローする」
- フォロー中: グレー色ボタン「フォロー中」

```tsx
<button
  onClick={isFollowing ? handleUnfollow : handleFollow}
  className={`px-6 py-2 rounded-lg font-bold transition-colors ${
    isFollowing
      ? 'bg-gray-300 text-gray-700 hover:bg-gray-400'
      : 'bg-pink-500 text-white hover:bg-pink-600'
  }`}
>
  {isFollowing ? 'フォロー中' : 'フォローする'}
</button>
```

### フォロー数表示
```tsx
<div className="flex items-center space-x-2">
  <Users className="h-5 w-5 text-gray-500" />
  <span>{followerCount}人がフォロー中</span>
</div>
```

### フォロー中バッジ（将来実装）
Talk枠カードにバッジ表示:
```tsx
{isFollowingInfluencer && (
  <span className="bg-purple-100 text-purple-600 px-2 py-1 rounded-full text-xs">
    フォロー中
  </span>
)}
```

## エラーハンドリング

### フォローエラー
- 既にフォロー中: エラーメッセージ（通常発生しない）
- 自分自身をフォロー: `自分自身をフォローすることはできません`
- DB エラー: `フォローに失敗しました`

### アンフォローエラー
- 既にアンフォロー済み: エラーメッセージ（通常発生しない）
- DB エラー: `アンフォローに失敗しました`

## セキュリティ

### RLS (Row Level Security)
```sql
-- 自分のフォローのみ作成可能
CREATE POLICY "Users can create own follows"
ON follows
FOR INSERT
WITH CHECK (auth.uid() = follower_id);

-- 自分のフォローのみ削除可能
CREATE POLICY "Users can delete own follows"
ON follows
FOR DELETE
USING (auth.uid() = follower_id);

-- 全員が閲覧可能
CREATE POLICY "Anyone can view follows"
ON follows
FOR SELECT
USING (true);
```

### バリデーション
- follower_id と followed_id が同一でないことを確認
- ユーザーの存在確認

## パフォーマンス最適化

### インデックス活用
- フォロー状態確認: 複合インデックス使用
- フォロワー数取得: `followed_id` インデックス使用
- フォロー中一覧取得: `follower_id` インデックス使用

### キャッシング（将来実装）
- フォロー中のインフルエンサーIDをメモリにキャッシュ
- フォロー/アンフォロー時に更新

### バッチ処理（将来実装）
- フォロワー数の定期集計
- 統計情報の更新

## 通知機能（将来実装）

### フォロワー通知
- 新規フォロワー獲得時にインフルエンサーへ通知
- メール通知（設定で ON/OFF 可能）

### フォロー中のTalk枠通知
- フォロー中のインフルエンサーが新規Talk枠作成
- プッシュ通知
- メール通知

## 分析機能（将来実装）

### フォロワー分析
- フォロワー数の推移グラフ
- 新規フォロワー獲得数（日別/週別/月別）
- アンフォロー数の推移

### フォロー中分析
- 最もTalkを購入しているインフルエンサー
- フォロー中のアクティブ率

## プライバシー設定（将来実装）

### フォロー非公開設定
- フォロー一覧を他のユーザーに非公開
- フォロワー一覧を他のユーザーに非公開

### ブロック機能
- 特定ユーザーをブロック
- ブロックされたユーザーはフォロー不可
