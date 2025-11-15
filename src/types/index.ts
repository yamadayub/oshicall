export interface User {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
  nickname?: string;
  bio?: string;
  oshi_tags: string[];
  fan_tags: string[];
  total_spent: number;
  successful_bids: number;
  created_at: string;
}

export interface UserProfile extends User {
  oshi_rank: OshiRank;
  total_points: number;
  call_count: number;
  call_minutes: number;
  bid_count: number;
  event_count: number;
  badges: Badge[];
  privacy_settings: PrivacySettings;
}

export interface OshiRank {
  level: 'Newbie' | 'Regular' | 'Devoted' | 'Top Fan';
  points: number;
  title: string;
  description: string;
  color: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned_at: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface ActivityLog {
  id: string;
  type: 'call' | 'bid' | 'event';
  title: string;
  description: string;
  influencer_name?: string;
  amount?: number;
  duration?: number;
  result: 'success' | 'failed' | 'pending';
  date: string;
}

export interface Collection {
  id: string;
  session_id: string;
  influencer_name: string;
  influencer_avatar: string;
  date: string;
  duration: number;
  thumbnail: string;
}

export interface PrivacySettings {
  profile_visibility: 'public' | 'link_only' | 'private';
  call_history_visibility: 'public' | 'private';
  influencer_visibility: { [influencerId: string]: boolean };
}

export interface Influencer {
  id: string;
  name: string;
  username: string;
  avatar_url: string;
  description: string;
  follower_count: number;
  total_earned: number;
  total_talks: number;
  rating: number;
  created_at: string;
}

export interface TalkSession {
  id: string;
  purchased_slot_id?: string; // ID of the purchased_slots record for joining calls
  influencer_id: string;
  influencer: Influencer;
  title: string;
  description: string;
  host_message: string;
  start_time: string;
  end_time: string;
  auction_end_time: string;
  starting_price: number;
  current_highest_bid: number;
  buy_now_price?: number | null;
  winner_id?: string;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled' | 'won';
  call_status?: 'pending' | 'ready' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'; // purchased_slots.call_status
  created_at: string;
  detail_image_url: string;
  is_female_only: boolean;
}

export interface Bid {
  id: string;
  talk_session_id: string;
  user_id: string;
  user: User;
  amount: number;
  created_at: string;
}

export interface Message {
  id: string;
  talk_session_id: string;
  user_id: string;
  content: string;
  created_at: string;
}