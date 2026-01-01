// 通話API関数
import { getBackendUrl } from '../lib/backend';
const API_BASE_URL = getBackendUrl();

export interface CreateRoomResponse {
  success: boolean;
  roomUrl: string;
  token: string;
  callSlot: {
    title: string;
    scheduled_start_time: string;
    duration_minutes: number;
  };
  timeUntilStart: number;
}

export interface JoinRoomResponse {
  success: boolean;
  roomUrl: string;
  token: string;
  userName: string;
}

export interface EndCallResponse {
  success: boolean;
  duration: number;
  message: string;
}

export interface CallStatusResponse {
  status: string; // call_status (waiting, in_progress, completed)
  call_status?: string; // alias for status
  scheduled_start_time: string;
  duration_minutes: number;
  time_until_start_seconds: number;
  participants: {
    influencer_entered_waiting_room: boolean;
    influencer_joined: boolean;
    fan_entered_waiting_room: boolean;
    fan_joined: boolean;
  };
  // タイムスタンプ情報
  influencer_entered_waiting_room_at: string | null;
  fan_entered_waiting_room_at: string | null;
  influencer_joined_at: string | null;
  fan_joined_at: string | null;
  // 表示用ステータス
  influencer_status: '未入室' | '待機中' | '通話中';
  fan_status: '未入室' | '待機中' | '通話中';
  can_join: boolean;
  room_created: boolean;
}

/**
 * 通話ルームを作成
 */
export const createCallRoom = async (
  purchasedSlotId: string,
  userId: string
): Promise<CreateRoomResponse> => {
  console.log('🔵 createCallRoom API呼び出し:', { purchasedSlotId, userId, apiUrl: `${API_BASE_URL}/api/calls/create-room` });

  const response = await fetch(`${API_BASE_URL}/api/calls/create-room`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ purchasedSlotId, userId }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('❌ createCallRoom APIエラー:', {
      status: response.status,
      error: error,
    });
    const errorMessage = error.details || error.error || 'ルーム作成に失敗しました';
    throw new Error(errorMessage);
  }

  const result = await response.json();
  console.log('✅ createCallRoom API成功:', result);
  return result;
};

/**
 * 通話ルームに参加
 */
export const joinCallRoom = async (
  purchasedSlotId: string,
  userId: string
): Promise<JoinRoomResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/calls/join-room`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ purchasedSlotId, userId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'ルーム参加に失敗しました');
  }

  return response.json();
};

/**
 * 通話を終了
 */
export const endCall = async (
  purchasedSlotId: string,
  userId: string
): Promise<EndCallResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/calls/end-call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ purchasedSlotId, userId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '通話終了に失敗しました');
  }

  return response.json();
};

/**
 * 通話ステータスを取得
 */
export const getCallStatus = async (
  purchasedSlotId: string
): Promise<CallStatusResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/calls/status/${purchasedSlotId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'ステータス取得に失敗しました');
  }

  return response.json();
};

