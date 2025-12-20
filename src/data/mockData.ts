import { Influencer, TalkSession, Bid, UserProfile, Badge, ActivityLog, Collection } from '../types';

export const mockInfluencers: Influencer[] = [
  {
    id: '1',
    name: 'あいり',
    username: 'HoneySpice',
    avatar_url: '/images/talks/1.jpg',
    description: '今日もお喋りしましょうね〜✨',
    follower_count: 12500,
    total_earned: 185000,
    total_talks: 15,
    rating: 4.8,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'みく',
    username: 'PinkySpice',
    avatar_url: '/images/talks/2.jpg',
    description: 'こんにちは〜💕 今日の出来事聞かせて！',
    follower_count: 18200,
    total_earned: 245000,
    total_talks: 22,
    rating: 4.9,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    name: 'ゆめか',
    username: 'PolaLight',
    avatar_url: '/images/talks/3.jpg',
    description: '一緒にお茶しながらお喋りしませんか？✨',
    follower_count: 15800,
    total_earned: 220000,
    total_talks: 18,
    rating: 4.7,　
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '4',
    name: 'りな',
    username: 'HoneySpice',
    avatar_url: '/images/talks/4.jpg',
    description: '可愛い話たくさんしましょうね🎀',
    follower_count: 9400,
    total_earned: 125000,
    total_talks: 12,
    rating: 4.9,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '5',
    name: 'かな',
    username: 'PolaLight',
    avatar_url: '/images/talks/5.jpg',
    description: '音楽の話で盛り上がりましょう🎸',
    follower_count: 11600,
    total_earned: 165000,
    total_talks: 14,
    rating: 4.6,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '6',
    name: 'まい',
    username: 'PinkySpice',
    avatar_url: '/images/talks/6.jpg',
    description: '一緒に笑顔になりましょう☀️',
    follower_count: 14300,
    total_earned: 195000,
    total_talks: 20,
    rating: 4.8,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '7',
    name: 'えみ',
    username: 'HoneySpice',
    avatar_url: '/images/talks/7.jpg',
    description: '和風な話で盛り上がりましょう🌸',
    follower_count: 8700,
    total_earned: 135000,
    total_talks: 11,
    rating: 4.9,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '8',
    name: 'れん',
    username: 'PolaLight',
    avatar_url: '/images/talks/8.jpg',
    description: 'ダークな話で盛り上がりましょう🖤',
    follower_count: 7200,
    total_earned: 98000,
    total_talks: 9,
    rating: 4.7,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '9',
    name: 'あや',
    username: 'PinkySpice',
    avatar_url: '/images/talks/9.jpg',
    description: 'ゲームの話で盛り上がりましょう🎮',
    follower_count: 16500,
    total_earned: 235000,
    total_talks: 19,
    rating: 4.8,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '10',
    name: 'さき',
    username: 'HoneySpice',
    avatar_url: '/images/talks/10.jpg',
    description: 'スイーツの話で盛り上がりましょう🍰',
    follower_count: 13100,
    total_earned: 175000,
    total_talks: 16,
    rating: 4.9,
    created_at: '2024-01-01T00:00:00Z',
  },
];

export const mockTalkSessions: TalkSession[] = [
  {
    id: '1',
    influencer_id: '1',
    influencer: mockInfluencers[0],
    title: '',
    description: '',
    host_message: '今日もお喋りしましょうね♪',
    start_time: '2025-01-22T23:00:00Z',
    end_time: '2025-01-22T23:30:00Z',
    auction_end_time: '2025-01-21T15:30:00Z',
    starting_price: 3000,
    current_highest_bid: 8500,
    status: 'upcoming',
    created_at: '2025-01-15T00:00:00Z',
    detail_image_url: '/images/talk_details/T1.jpg',
    is_female_only: true,
  },
  {
    id: '2',
    influencer_id: '2',
    influencer: mockInfluencers[1],
    title: '',
    description: '',
    host_message: 'こんにちは〜💕 今日の出来事聞かせて！',
    start_time: '2025-01-23T20:00:00Z',
    end_time: '2025-01-23T20:45:00Z',
    auction_end_time: '2025-01-21T18:45:00Z',
    starting_price: 4000,
    current_highest_bid: 12000,
    status: 'upcoming',
    created_at: '2025-01-15T00:00:00Z',
    detail_image_url: '/images/talk_details/T2.jpg',
    is_female_only: true,
  },
  {
    id: '3',
    influencer_id: '3',
    influencer: mockInfluencers[2],
    title: '',
    description: '',
    host_message: '一緒にお茶しながらお喋りしませんか？✨',
    start_time: '2025-01-24T19:30:00Z',
    end_time: '2025-01-24T20:30:00Z',
    auction_end_time: '2025-01-21T22:15:00Z',
    starting_price: 5000,
    current_highest_bid: 18000,
    status: 'upcoming',
    created_at: '2025-01-15T00:00:00Z',
    detail_image_url: '/images/talk_details/T3.jpg',
    is_female_only: true,
  },
  {
    id: '4',
    influencer_id: '4',
    influencer: mockInfluencers[3],
    title: '',
    description: '',
    host_message: '可愛い話たくさんしましょうね🎀',
    start_time: '2025-01-25T15:00:00Z',
    end_time: '2025-01-25T15:30:00Z',
    auction_end_time: '2025-01-22T09:20:00Z',
    starting_price: 3500,
    current_highest_bid: 9500,
    status: 'upcoming',
    created_at: '2025-01-15T00:00:00Z',
    detail_image_url: '/images/talk_details/T4.jpg',
    is_female_only: true,
  },
  {
    id: '5',
    influencer_id: '5',
    influencer: mockInfluencers[4],
    title: '',
    description: '',
    host_message: '音楽の話で盛り上がりましょう🎸',
    start_time: '2025-01-26T21:00:00Z',
    end_time: '2025-01-26T21:45:00Z',
    auction_end_time: '2025-01-22T16:30:00Z',
    starting_price: 4500,
    current_highest_bid: 13500,
    status: 'upcoming',
    created_at: '2025-01-15T00:00:00Z',
    detail_image_url: '/images/talk_details/T5.jpg',
    is_female_only: false,
  },
  {
    id: '6',
    influencer_id: '6',
    influencer: mockInfluencers[5],
    title: 'みんなで元気チャージ☀️',
    description: '疲れた心を癒やします♪悩み相談や愚痴聞きもOK！一緒に笑顔になりましょう〜',
    host_message: '一緒に笑顔になりましょう☀️',
    start_time: '2025-01-27T18:00:00Z',
    end_time: '2025-01-27T18:30:00Z',
    auction_end_time: '2025-01-23T11:45:00Z',
    starting_price: 3000,
    current_highest_bid: 7500,
    status: 'upcoming',
    created_at: '2025-01-15T00:00:00Z',
    detail_image_url: '/images/talk_details/T6.jpg',
    is_female_only: false,
  },
  {
    id: '7',
    influencer_id: '7',
    influencer: mockInfluencers[6],
    title: '和風お茶会タイム🌸',
    description: '着物を着てお茶会気分でお話ししましょう♪日本文化についても語り合いませんか？',
    host_message: '和風な話で盛り上がりましょう🌸',
    start_time: '2025-01-28T16:00:00Z',
    end_time: '2025-01-28T16:45:00Z',
    auction_end_time: '2025-01-23T20:10:00Z',
    starting_price: 4000,
    current_highest_bid: 11000,
    status: 'upcoming',
    created_at: '2025-01-15T00:00:00Z',
    detail_image_url: '/images/talk_details/T7.jpg',
    is_female_only: false,
  },
  {
    id: '8',
    influencer_id: '8',
    influencer: mockInfluencers[7],
    title: 'ダークサイド語り🖤',
    description: 'ゴシック文化やダークな世界観について語り合いましょう...普通じゃつまらない人集まれ',
    host_message: 'ダークな話で盛り上がりましょう🖤',
    start_time: '2025-01-29T22:00:00Z',
    end_time: '2025-01-29T22:30:00Z',
    auction_end_time: '2025-01-24T14:25:00Z',
    starting_price: 3500,
    current_highest_bid: 8000,
    status: 'upcoming',
    created_at: '2025-01-15T00:00:00Z',
    detail_image_url: '/images/talk_details/T8.jpg',
    is_female_only: false,
  },
  {
    id: '9',
    influencer_id: '9',
    influencer: mockInfluencers[8],
    title: 'ゲーム実況配信🎮',
    description: 'みんなでゲームの話をしましょう！最新のFPSやRPGについて熱く語ろう〜',
    host_message: 'ゲームの話で盛り上がりましょう🎮',
    start_time: '2025-01-30T20:30:00Z',
    end_time: '2025-01-30T21:15:00Z',
    auction_end_time: '2025-01-25T08:40:00Z',
    starting_price: 4500,
    current_highest_bid: 15500,
    status: 'upcoming',
    created_at: '2025-01-15T00:00:00Z',
    detail_image_url: '/images/talk_details/T9.jpg',
    is_female_only: false,
  },
  {
    id: '10',
    influencer_id: '10',
    influencer: mockInfluencers[9],
    title: 'スイーツ作り教室🍰',
    description: 'お菓子作りのコツを教えます♪一緒にレシピ交換しませんか？甘い時間を過ごしましょう〜',
    host_message: 'スイーツの話で盛り上がりましょう🍰',
    start_time: '2025-01-31T14:00:00Z',
    end_time: '2025-01-31T15:00:00Z',
    auction_end_time: '2025-01-25T19:55:00Z',
    starting_price: 3500,
    current_highest_bid: 10500,
    status: 'upcoming',
    created_at: '2025-01-15T00:00:00Z',
    detail_image_url: '/images/talk_details/T10.jpg',
    is_female_only: false,
  },
];

export const mockBids: Bid[] = [
  {
    id: '1',
    talk_session_id: '1',
    user_id: '1',
    user: {
      id: '1',
      username: 'otaku_master',
      email: 'otaku@example.com',
      oshi_tags: [],
      fan_tags: [],
      total_spent: 85000,
      successful_bids: 7,
      created_at: '2024-01-01T00:00:00Z',
    },
    amount: 8500,
    created_at: '2025-01-16T10:30:00Z',
  },
  {
    id: '2',
    talk_session_id: '2',
    user_id: '2',
    user: {
      id: '2',
      username: 'fashion_lover',
      email: 'fashion@example.com',
      oshi_tags: [],
      fan_tags: [],
      total_spent: 120000,
      successful_bids: 9,
      created_at: '2024-01-01T00:00:00Z',
    },
    amount: 12000,
    created_at: '2025-01-16T09:15:00Z',
  },
  {
    id: '3',
    talk_session_id: '3',
    user_id: '3',
    user: {
      id: '3',
      username: 'dance_fan',
      email: 'dance@example.com',
      oshi_tags: [],
      fan_tags: [],
      total_spent: 95000,
      successful_bids: 5,
      created_at: '2024-01-01T00:00:00Z',
    },
    amount: 18000,
    created_at: '2025-01-16T11:45:00Z',
  },
];

// Mock User Profile Data
export const mockUserProfile: UserProfile = {
  id: '1',
  username: 'oshi_fan_2024',
  email: 'user@example.com',
        avatar_url: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh6XGT5Hz9MpAiyfTHlBczavuUjyTBza9zWdzYmoifglj0p1lsylcTEScnpSa-Youh7YXw-ssgO-mMQmw-DBz4NeesioQPTe8beOH_QS-A4JMnfZAGP-01gxPQrS-pPEnrnJxbdVnWguhCC/s400/pose_pien_uruuru_woman.png',
  nickname: '美活アシスタント',
  bio: '美容とファッションが大好きな女子です💕 憧れのインフルエンサーさんから美活のコツを学んで、自分ももっと素敵になりたいです✨',
  oshi_tags: ['#美容', '#ファッション', '#スキンケア', '#メイク'],
  fan_tags: ['#美活女子', '#コスメ好き', '#ファッション初心者', '#美容学習中'],
  total_spent: 450000,
  successful_bids: 25,
  created_at: '2024-01-01T00:00:00Z',
  oshi_rank: {
    level: 'Devoted',
    points: 127,
    title: '美活エキスパート',
    description: '美容とファッションの学習熱心な女子',
    color: 'purple'
  },
  total_points: 127,
  call_count: 25,
  call_minutes: 750,
  bid_count: 89,
  event_count: 12,
  badges: [],
  privacy_settings: {
    profile_visibility: 'public',
    call_history_visibility: 'public',
    influencer_visibility: {}
  }
};

// Mock Badges
export const mockBadges: Badge[] = [
  {
    id: '1',
    name: '初通話',
    description: '初めての通話を完了しました',
    icon: '🎉',
    earned_at: '2024-01-15T10:00:00Z',
    rarity: 'common'
  },
  {
    id: '2',
    name: '通話マスター',
    description: '通話回数10回を達成しました',
    icon: '🎤',
    earned_at: '2024-02-20T15:30:00Z',
    rarity: 'rare'
  },
  {
    id: '3',
    name: 'マラソン通話',
    description: '30分連続通話を達成しました',
    icon: '🏃‍♂️',
    earned_at: '2024-03-10T20:45:00Z',
    rarity: 'epic'
  },
  {
    id: '4',
    name: 'レア推しハンター',
    description: 'レア推しとの通話を達成しました',
    icon: '💎',
    earned_at: '2024-03-25T14:20:00Z',
    rarity: 'legendary'
  },
  {
    id: '5',
    name: '月間トップ10%',
    description: '月間ランキング上位10%に入りました',
    icon: '🏆',
    earned_at: '2024-04-01T00:00:00Z',
    rarity: 'epic'
  }
];

// Mock Activity Logs
export const mockActivityLogs: ActivityLog[] = [
  {
    id: '1',
    type: 'call',
    title: 'あいりさんとの美容相談',
    description: 'スキンケアのコツを教えてもらいました💕',
    influencer_name: 'あいり',
    duration: 30,
    result: 'success',
    date: '2024-03-25T20:00:00Z'
  },
  {
    id: '2',
    type: 'bid',
    title: 'みくさんのファッション相談',
    description: 'みくさんのコーディネート相談枠に入札しました',
    influencer_name: 'みく',
    amount: 25000,
    result: 'success',
    date: '2024-03-24T18:30:00Z'
  },
  {
    id: '3',
    type: 'call',
    title: 'ゆめかさんとのメイク相談',
    description: 'ナチュラルメイクのコツを教えてもらいました✨',
    influencer_name: 'ゆめか',
    duration: 20,
    result: 'success',
    date: '2024-03-23T19:15:00Z'
  },
  {
    id: '4',
    type: 'bid',
    title: 'りなさんの美容相談',
    description: 'りなさんの美容相談枠に入札しましたが落札できませんでした',
    influencer_name: 'りな',
    amount: 18000,
    result: 'failed',
    date: '2024-03-22T16:45:00Z'
  },
  {
    id: '5',
    type: 'event',
    title: 'オンラインイベント参加',
    description: '美活女子交流会に参加しました💄',
    result: 'success',
    date: '2024-03-20T19:00:00Z'
  }
];

// Mock Collections
export const mockCollections: Collection[] = [
  {
    id: '1',
    session_id: 'SESS-001',
    influencer_name: 'あいり',
    influencer_avatar: '/images/talks/1.jpg',
    date: '2024-03-25T20:00:00Z',
    duration: 30,
    thumbnail: '/images/talks/1.jpg'
  },
  {
    id: '2',
    session_id: 'SESS-002',
    influencer_name: 'みく',
    influencer_avatar: '/images/talks/2.jpg',
    date: '2024-03-24T18:30:00Z',
    duration: 25,
    thumbnail: '/images/talks/2.jpg'
  },
  {
    id: '3',
    session_id: 'SESS-003',
    influencer_name: 'ゆめか',
    influencer_avatar: '/images/talks/3.jpg',
    date: '2024-03-23T19:15:00Z',
    duration: 20,
    thumbnail: '/images/talks/3.jpg'
  },
  {
    id: '4',
    session_id: 'SESS-004',
    influencer_name: 'りな',
    influencer_avatar: '/images/talks/4.jpg',
    date: '2024-03-20T21:00:00Z',
    duration: 35,
    thumbnail: '/images/talks/4.jpg'
  }
];

// Calculate Oshi Rank based on points
export const calculateOshiRank = (points: number): UserProfile['oshi_rank'] => {
  if (points >= 150) {
    return {
      level: 'Top Fan',
      points,
      title: 'Top Fan',
      description: 'トップファン',
      color: 'yellow'
    };
  } else if (points >= 70) {
    return {
      level: 'Devoted',
      points,
      title: 'Devoted Fan',
      description: '献身的なファン',
      color: 'purple'
    };
  } else if (points >= 20) {
    return {
      level: 'Regular',
      points,
      title: 'Regular Fan',
      description: '常連ファン',
      color: 'blue'
    };
  } else {
    return {
      level: 'Newbie',
      points,
      title: 'Newbie',
      description: '初心者ファン',
      color: 'green'
    };
  }
};

// Calculate points from user stats
export const calculatePoints = (callCount: number, callMinutes: number, bidCount: number, eventCount: number): number => {
  return (callCount * 3) + (callMinutes * 0.5) + (bidCount * 1) + (eventCount * 2);
};