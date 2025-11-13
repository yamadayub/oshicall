import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase環境変数が設定されていません');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// デフォルトアバター画像（データURIのSVGプレースホルダー）
export const DEFAULT_AVATAR = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiNEMUQ1REIiLz4KPHBhdGggZD0iTTIwIDEyQzE3LjI0IDEyIDE1IDE0LjI0IDE1IDE3QzE1IDE5Ljc2IDE3LjI0IDIyIDIwIDIyQzIyLjc2IDIyIDI1IDE5Ljc2IDI1IDE3QzI1IDE0LjI0IDIyLjc2IDEyIDIwIDEyWk0yMCAyNEMxNi42NyAyNCAxNCAyNS4zNCAxNCAyN1YyOUgyNlYyN0MyNiAyNS4zNCAyMy4zMyAyNCAyMCAyNFoiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+';

// 型定義
export interface User {
  id: string;
  auth_user_id: string;
  display_name: string;
  bio: string | null;
  profile_image_url: string | null;
  
  // 決済関連
  stripe_customer_id: string | null;
  stripe_account_id: string | null;
  
  // ユーザータイプ
  is_fan: boolean;
  is_influencer: boolean;
  
  // ファン統計
  has_payment_method: boolean;
  total_spent: number;
  total_calls_purchased: number;
  
  // インフルエンサー統計
  is_verified: boolean;
  total_earnings: number;
  total_calls_completed: number;
  average_rating: number | null;
  
  created_at: string;
  updated_at: string;
}

// 後方互換性のための型エイリアス
export type Influencer = User;
export type Fan = User;

export interface CallSlot {
  id: string;
  user_id: string; // インフルエンサーのuser_id
  fan_user_id: string | null; // 落札者（ファン）のuser_id（オークション終了後に設定）
  title: string;
  description: string | null;
  scheduled_start_time: string;
  duration_minutes: number;
  starting_price: number;
  minimum_bid_increment: number;
  buy_now_price: number | null; // 即決価格
  is_published: boolean;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
  auction_end_time?: string; // オークション終了時間
  auction_id?: string; // オークションID
}

export interface Auction {
  id: string;
  call_slot_id: string;
  status: 'draft' | 'scheduled' | 'active' | 'ended' | 'cancelled';
  start_time: string;
  end_time: string;
  current_highest_bid: number | null;
  current_winner_id: string | null;
  total_bids_count: number;
  unique_bidders_count: number;
  created_at: string;
  updated_at: string;
}

export interface Bid {
  id: string;
  auction_id: string;
  user_id: string;
  bid_amount: number;
  is_autobid: boolean;
  stripe_payment_intent_id: string | null;
  created_at: string;
}

export interface PurchasedSlot {
  id: string;
  call_slot_id: string;
  auction_id: string;
  fan_user_id: string;
  influencer_user_id: string;
  winning_bid_amount: number;
  platform_fee: number;
  influencer_payout: number;
  call_status: 'pending' | 'ready' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  video_call_room_id: string | null;
  call_started_at: string | null;
  call_ended_at: string | null;
  purchased_at: string;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface FollowCounts {
  followers_count: number;
  following_count: number;
}


