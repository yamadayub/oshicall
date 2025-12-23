-- =========================================
-- call_slotsテーブルに論理削除カラムを追加
-- =========================================
-- deleted_atカラムを追加して、テストデータなどを手動で表示対象外にできるようにする
-- =========================================

-- 1. deleted_atカラムを追加
ALTER TABLE call_slots
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 2. インデックスを追加（パフォーマンス向上のため）
CREATE INDEX idx_call_slots_deleted_at ON call_slots(deleted_at) WHERE deleted_at IS NULL;

-- 3. コメントを追加
COMMENT ON COLUMN call_slots.deleted_at IS '論理削除時刻。NULLの場合は削除されていない。';

-- =========================================
-- 完了
-- =========================================
-- これで以下が可能になります:
-- 1. テストデータを手動で表示対象外にできる（deleted_atを設定）
-- 2. すべての取得クエリで .is('deleted_at', null) を追加することで、削除されたデータを除外
-- 3. 物理削除ではなく論理削除により、データの復元が可能

