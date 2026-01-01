-- ============================================
-- purchased_slotsテーブルに待機室入室時刻カラムを追加
-- Issue #1対応: CallPage入室時刻を記録するため
-- ============================================

-- インフルエンサーがCallPageに入室した時刻
ALTER TABLE purchased_slots 
ADD COLUMN IF NOT EXISTS influencer_entered_waiting_room_at timestamp with time zone;

-- ファンがCallPageに入室した時刻
ALTER TABLE purchased_slots 
ADD COLUMN IF NOT EXISTS fan_entered_waiting_room_at timestamp with time zone;

-- コメント追加（ドキュメント用）
COMMENT ON COLUMN purchased_slots.influencer_entered_waiting_room_at IS 'インフルエンサーがCallPage（待機室）に入室した時刻。Daily.coセッション入室とは異なる。';
COMMENT ON COLUMN purchased_slots.fan_entered_waiting_room_at IS 'ファンがCallPage（待機室）に入室した時刻。Daily.coセッション入室とは異なる。';

