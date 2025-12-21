// Daily.co ビデオ通話ユーティリティ
import axios from 'axios';

interface DailyRoomConfig {
  roomName: string;
  roomUrl: string;
}

interface MeetingTokenResult {
  token: string;
}

// Daily.co APIクライアントを取得（環境変数を動的に読み込む）
const getDailyApi = () => {
  const DAILY_API_KEY = process.env.DAILY_API_KEY;
  
  if (!DAILY_API_KEY) {
    throw new Error('DAILY_API_KEY が設定されていません。環境変数を確認してください。');
  }

  return axios.create({
    baseURL: 'https://api.daily.co/v1',
    headers: {
      'Authorization': `Bearer ${DAILY_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
};

/**
 * Daily.coルームを作成
 */
export const createDailyRoom = async (
  purchasedSlotId: string,
  scheduledStartTime: Date,
  durationMinutes: number
): Promise<DailyRoomConfig> => {
  try {
    const dailyApi = getDailyApi();
    const roomName = `call-${purchasedSlotId}`;
    
    // Unix timestampに変換
    const startTime = Math.floor(scheduledStartTime.getTime() / 1000);
    const nbf = startTime - (15 * 60); // 15分前から入室可能
    const exp = startTime + (durationMinutes * 60) + (10 * 60); // 終了10分後まで有効

    console.log('🔵 Daily.coルーム作成:', {
      roomName,
      nbf: new Date(nbf * 1000).toISOString(),
      exp: new Date(exp * 1000).toISOString(),
    });

    const response = await dailyApi.post('/rooms', {
      name: roomName,
      privacy: 'private',
      properties: {
        max_participants: 2,
        nbf: nbf,
        exp: exp,
        enable_chat: true,
        enable_screenshare: true,
        start_video_off: false,
        start_audio_off: false,
        enable_prejoin_ui: false,
        enable_network_ui: true,
        enable_noise_cancellation_ui: true,
      },
    });

    console.log('✅ Daily.coルーム作成成功:', response.data.name);

    return {
      roomName: response.data.name,
      roomUrl: response.data.url,
    };
  } catch (error: any) {
    // 409 Conflict: ルームが既に存在
    if (error.response?.status === 409) {
      const roomName = `call-${purchasedSlotId}`;
      console.log('⚠️ ルームが既に存在します。既存のルーム情報を取得:', roomName);
      
      const roomInfo = await getDailyRoomInfo(roomName);
      return {
        roomName: roomInfo.name,
        roomUrl: roomInfo.url,
      };
    }

    // 401 Unauthorized: APIキーの問題
    if (error.response?.status === 401) {
      throw new Error('Daily.co APIキーが無効です。環境変数を確認してください。');
    }

    console.error('❌ Daily.coルーム作成エラー:', error.response?.data || error.message);
    throw new Error(`ルーム作成に失敗しました: ${error.response?.data?.error || error.message}`);
  }
};

/**
 * Daily.coルーム情報を取得
 */
export const getDailyRoomInfo = async (roomName: string): Promise<any> => {
  try {
    const dailyApi = getDailyApi();
    const response = await dailyApi.get(`/rooms/${roomName}`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw new Error('ルームが見つかりません');
    }
    throw error;
  }
};

/**
 * Daily.coルームを削除
 */
export const deleteDailyRoom = async (roomName: string): Promise<{ success: boolean }> => {
  try {
    const dailyApi = getDailyApi();
    console.log('🔵 Daily.coルーム削除:', roomName);
    await dailyApi.delete(`/rooms/${roomName}`);
    console.log('✅ Daily.coルーム削除成功');
    return { success: true };
  } catch (error: any) {
    // 404 Not Found: 既に削除済み
    if (error.response?.status === 404) {
      console.log('⚠️ ルームは既に削除されています');
      return { success: true };
    }

    console.warn('⚠️ Daily.coルーム削除エラー（継続）:', error.response?.data || error.message);
    return { success: false };
  }
};

/**
 * ミーティングトークンを生成
 */
export const generateMeetingToken = async (
  roomName: string,
  userId: string,
  userName: string,
  isOwner: boolean
): Promise<MeetingTokenResult> => {
  try {
    const dailyApi = getDailyApi();
    console.log('🔵 ミーティングトークン生成:', { roomName, userId, userName, isOwner });

    const response = await dailyApi.post('/meeting-tokens', {
      properties: {
        room_name: roomName,
        user_name: userName,
        user_id: userId,
        is_owner: isOwner,
        exp: Math.floor(Date.now() / 1000) + 86400, // 24時間有効
      },
    });

    console.log('✅ ミーティングトークン生成成功');

    return { token: response.data.token };
  } catch (error: any) {
    console.error('❌ ミーティングトークン生成エラー:', error.response?.data || error.message);
    throw new Error(`トークン生成に失敗しました: ${error.response?.data?.error || error.message}`);
  }
};

/**
 * Daily.co Webhookを作成
 * 全ドメインのイベントを受信するWebhookを設定
 */
export const createDailyWebhook = async (webhookUrl: string): Promise<any> => {
  try {
    const dailyApi = getDailyApi();

    console.log('🔵 Daily.co Webhook作成:', webhookUrl);

    // Daily.coのWebhook API: urlのみを指定（全イベントを自動送信）
    // 参考: https://docs.daily.co/reference/rest-api/webhooks
    const requestBody = {
      url: webhookUrl
    };

    console.log('🔵 Webhook作成リクエスト:', JSON.stringify(requestBody, null, 2));

    const response = await dailyApi.post('/webhooks', requestBody);

    console.log('✅ Webhook作成成功:', response.data);
    return response.data;

  } catch (error: any) {
    const errorDetails = error.response?.data || error.message;
    console.error('❌ Webhook作成エラー詳細:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    throw new Error(`Webhook作成に失敗: ${JSON.stringify(errorDetails)}`);
  }
};

/**
 * Daily.co Webhookの一覧を取得
 */
export const listDailyWebhooks = async (): Promise<any[]> => {
  try {
    const dailyApi = getDailyApi();
    const response = await dailyApi.get('/webhooks');
    return response.data.data || [];
  } catch (error: any) {
    console.error('❌ Webhook一覧取得エラー:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Daily.co Webhookを削除
 */
export const deleteDailyWebhook = async (webhookId: string): Promise<void> => {
  try {
    const dailyApi = getDailyApi();
    await dailyApi.delete(`/webhooks/${webhookId}`);
    console.log('✅ Webhook削除成功:', webhookId);
  } catch (error: any) {
    console.error('❌ Webhook削除エラー:', error.response?.data || error.message);
    throw error;
  }
};
