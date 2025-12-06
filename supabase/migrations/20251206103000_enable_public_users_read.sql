-- Give access to the public to view users table
-- This is necessary for the Top page and Auction screen to display influencer information

-- Drop existing policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Public users are viewable by everyone" ON users;

-- Create policy to allow everyone to view users
CREATE POLICY "Public users are viewable by everyone"
ON users FOR SELECT
USING (true);
