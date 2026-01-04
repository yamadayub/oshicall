-- ============================================
-- usersテーブルにplatform_fee_rateカラムを追加
-- Destination Charges方式の実装に伴い、インフルエンサーごとの手数料率を設定可能にする
-- ============================================

-- platform_fee_rateカラムを追加
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS platform_fee_rate numeric DEFAULT 0.2;

-- コメント追加
COMMENT ON COLUMN users.platform_fee_rate IS 'プラットフォーム手数料率（0.0-1.0）。デフォルトは0.2（20%）。初期インフルエンサーは0.0（0%）に設定可能。';

-- 既存のインフルエンサーに対してデフォルト値を設定（既に存在する場合は更新しない）
UPDATE users
SET platform_fee_rate = 0.2
WHERE is_influencer = true 
  AND platform_fee_rate IS NULL;

