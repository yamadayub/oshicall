-- ============================================
-- usersテーブルにinfluencer_application_statusカラムを追加
-- インフルエンサー申請のステータス管理
-- ============================================

-- influencer_application_statusカラムを追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS influencer_application_status TEXT DEFAULT NULL;

-- コメントを追加
COMMENT ON COLUMN users.influencer_application_status IS 'インフルエンサー申請ステータス (pending, approved, rejected, null)';
