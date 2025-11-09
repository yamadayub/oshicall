// 通話エンドポイント
import { Router, Request, Response } from 'express';
import { createDailyRoom, generateMeetingToken, deleteDailyRoom } from '../utils/daily';

const router = Router();

// Supabaseクライアントを受け取る関数
export const createCallsRouter = (supabase: any) => {

// ============================================
// POST /api/calls/create-room
// 通話ルームを作成
// ============================================
router.post('/create-room', async (req: Request, res: Response) => {
  try {
    const { purchasedSlotId, userId } = req.body;

    console.log('🔵 通話ルーム作成開始:', { purchasedSlotId, userId });

    // 1. purchased_slotsとcall_slotsを取得
    const { data: purchasedSlot, error: fetchError } = await supabase
      .from('purchased_slots')
      .select(`
        *,
        call_slots (
          title,
          scheduled_start_time,
          duration_minutes
        )
      `)
      .eq('id', purchasedSlotId)
      .single();

    if (fetchError || !purchasedSlot) {
      return res.status(404).json({ error: '通話情報が見つかりません' });
    }

    // 2. ユーザー確認
    const isInfluencer = purchasedSlot.influencer_user_id === userId;
    const isFan = purchasedSlot.fan_user_id === userId;

    console.log('🔵 ユーザー権限確認:', {
      userId,
      isInfluencer,
      isFan,
      influencer_user_id: purchasedSlot.influencer_user_id,
      fan_user_id: purchasedSlot.fan_user_id,
    });

    if (!isInfluencer && !isFan) {
      console.error('❌ アクセス権限なし');
      return res.status(403).json({ error: 'アクセス権限がありません' });
    }

    // 3. call_status確認
    console.log('🔵 call_status確認:', { call_status: purchasedSlot.call_status });

    // 通話ルーム作成は pending, ready, in_progress 状態で許可
    // (in_progressは片方が先に入室した場合)
    if (!['pending', 'ready', 'in_progress'].includes(purchasedSlot.call_status)) {
      console.warn(`⚠️ call_status不正: ${purchasedSlot.call_status}`);
      return res.status(400).json({
        error: `通話は${purchasedSlot.call_status}状態のため入室できません`
      });
    }

    // 4. call_slotsの取得と時刻計算
    const callSlot = Array.isArray(purchasedSlot.call_slots)
      ? purchasedSlot.call_slots[0]
      : purchasedSlot.call_slots;

    if (!callSlot) {
      console.error('❌ call_slotsが見つかりません');
      return res.status(400).json({ error: 'Talk枠情報が見つかりません' });
    }

    const scheduledTime = new Date(callSlot.scheduled_start_time);
    const now = new Date();
    const minutesUntilStart = (scheduledTime.getTime() - now.getTime()) / 60000;

    console.log('🔵 時刻確認:', {
      scheduled_start_time: callSlot.scheduled_start_time,
      now: now.toISOString(),
      minutesUntilStart: minutesUntilStart.toFixed(2),
    });

    // 待機室にはいつでも入室可能（15分制限を削除）

    let roomUrl = '';
    let roomName = purchasedSlot.video_call_room_id;

    // 5. ルームが未作成の場合は作成（待機室への入室）
    if (!roomName) {
      console.log('🔵 新規ルーム作成開始（待機室）');
      try {
        const room = await createDailyRoom(
          purchasedSlotId,
          scheduledTime,
          callSlot.duration_minutes
        );

        roomName = room.roomName;
        roomUrl = room.roomUrl;
        console.log('✅ Daily.coルーム作成完了:', { roomName, roomUrl });

        // Supabaseに保存（待機室への入室なので joined_at は記録しない）
        const { error: updateError } = await supabase
          .from('purchased_slots')
          .update({
            video_call_room_id: roomName,
            call_status: 'ready',
          })
          .eq('id', purchasedSlotId);

        if (updateError) {
          console.error('❌ Supabase更新エラー:', updateError);
          throw updateError;
        }

        console.log('✅ ルーム情報をSupabaseに保存（待機室）:', roomName);
      } catch (roomError: any) {
        console.error('❌ ルーム作成エラー:', roomError);
        return res.status(500).json({
          error: 'ルーム作成に失敗しました',
          details: roomError.message,
        });
      }
    } else {
      // 既存のルームURLを構築（待機室に再入室）
      const domain = process.env.DAILY_DOMAIN || 'oshicall.daily.co';
      roomUrl = domain.includes('.daily.co')
        ? `https://${domain}/${roomName}`
        : `https://${domain}.daily.co/${roomName}`;
      console.log('✅ 既存のルームを使用（待機室に入室）:', roomName);
    }

    // 6. ミーティングトークンを生成
    const { data: userData } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', userId)
      .single();

    const userName = userData?.display_name || 'ゲスト';
    const { token } = await generateMeetingToken(roomName, userId, userName, isInfluencer);

    // 7. レスポンス
    const timeUntilStart = Math.max(0, Math.floor(minutesUntilStart * 60));

    res.json({
      success: true,
      roomUrl,
      token,
      callSlot: {
        title: callSlot.title,
        scheduled_start_time: callSlot.scheduled_start_time,
        duration_minutes: callSlot.duration_minutes,
      },
      timeUntilStart,
    });

  } catch (error: any) {
    console.error('❌ 通話ルーム作成エラー:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
    });
    res.status(500).json({
      error: error.message || 'ルーム作成に失敗しました',
      details: error.response?.data || error.toString(),
    });
  }
});

// ============================================
// POST /api/calls/join-room
// 通話ルームに参加
// ============================================
router.post('/join-room', async (req: Request, res: Response) => {
  try {
    const { purchasedSlotId, userId } = req.body;

    console.log('🔵 通話ルーム参加:', { purchasedSlotId, userId });

    // 1. purchased_slotsを取得
    const { data: purchasedSlot, error: fetchError } = await supabase
      .from('purchased_slots')
      .select('*')
      .eq('id', purchasedSlotId)
      .single();

    if (fetchError || !purchasedSlot) {
      return res.status(404).json({ error: '通話情報が見つかりません' });
    }

    // 2. ユーザー確認
    const isInfluencer = purchasedSlot.influencer_user_id === userId;
    const isFan = purchasedSlot.fan_user_id === userId;

    if (!isInfluencer && !isFan) {
      return res.status(403).json({ error: 'アクセス権限がありません' });
    }

    // 3. ルーム名確認
    if (!purchasedSlot.video_call_room_id) {
      return res.status(400).json({ error: 'ルームがまだ作成されていません' });
    }

    // 4. 参加日時を記録（実際の通話開始時）
    const updateData: any = {};
    const currentTime = new Date().toISOString();

    if (isInfluencer) {
      updateData.influencer_joined_at = currentTime;
      console.log('🔵 インフルエンサーが通話に参加:', currentTime);
    } else {
      updateData.fan_joined_at = currentTime;
      console.log('🔵 ファンが通話に参加:', currentTime);
    }

    // 5. call_statusを更新
    if (purchasedSlot.call_status === 'pending' || purchasedSlot.call_status === 'ready') {
      updateData.call_status = 'in_progress';
    }

    // 6. call_started_atを記録（初回のみ）
    if (!purchasedSlot.call_started_at) {
      updateData.call_started_at = currentTime;
      console.log('🔵 通話開始時刻を記録:', currentTime);
    }

    const { error: updateError } = await supabase
      .from('purchased_slots')
      .update(updateData)
      .eq('id', purchasedSlotId);

    if (updateError) {
      console.error('❌ 参加情報更新エラー:', updateError);
      throw updateError;
    }

    console.log('✅ 参加情報を記録:', updateData);

    // 7. ミーティングトークンを生成
    const { data: userData } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', userId)
      .single();

    const userName = userData?.display_name || 'ゲスト';
    const domain = process.env.DAILY_DOMAIN || 'oshicall.daily.co';
    const roomUrl = domain.includes('.daily.co') 
      ? `https://${domain}/${purchasedSlot.video_call_room_id}`
      : `https://${domain}.daily.co/${purchasedSlot.video_call_room_id}`;
    const { token } = await generateMeetingToken(
      purchasedSlot.video_call_room_id,
      userId,
      userName,
      isInfluencer
    );

    res.json({
      success: true,
      roomUrl,
      token,
      userName,
    });

  } catch (error: any) {
    console.error('❌ 通話ルーム参加エラー:', error);
    res.status(500).json({ error: error.message || 'ルーム参加に失敗しました' });
  }
});

// ============================================
// POST /api/calls/end-call
// 通話を終了
// ============================================
router.post('/end-call', async (req: Request, res: Response) => {
  try {
    const { purchasedSlotId, userId } = req.body;

    console.log('🔵 通話終了:', { purchasedSlotId, userId });

    // 1. purchased_slotsを取得
    const { data: purchasedSlot, error: fetchError } = await supabase
      .from('purchased_slots')
      .select('*')
      .eq('id', purchasedSlotId)
      .single();

    if (fetchError || !purchasedSlot) {
      return res.status(404).json({ error: '通話情報が見つかりません' });
    }

    // 2. ユーザー確認
    const isInfluencer = purchasedSlot.influencer_user_id === userId;
    const isFan = purchasedSlot.fan_user_id === userId;

    if (!isInfluencer && !isFan) {
      return res.status(403).json({ error: 'アクセス権限がありません' });
    }

    // 3. 通話終了情報を更新
    const endTime = new Date();
    let actualDuration = 0;

    if (purchasedSlot.call_started_at) {
      const startTime = new Date(purchasedSlot.call_started_at);
      actualDuration = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);
    }

    await supabase
      .from('purchased_slots')
      .update({
        call_ended_at: endTime.toISOString(),
        call_status: 'completed',
        call_actual_duration_minutes: actualDuration,
      })
      .eq('id', purchasedSlotId);

    console.log('✅ 通話終了情報を記録:', { actualDuration });

    // 4. Daily.coルームを削除
    if (purchasedSlot.video_call_room_id) {
      await deleteDailyRoom(purchasedSlot.video_call_room_id);
    }

    res.json({
      success: true,
      duration: actualDuration,
      message: '通話が終了しました',
    });

  } catch (error: any) {
    console.error('❌ 通話終了エラー:', error);
    res.status(500).json({ error: error.message || '通話終了処理に失敗しました' });
  }
});

// ============================================
// GET /api/calls/status/:purchasedSlotId
// 通話ステータスを取得
// ============================================
router.get('/status/:purchasedSlotId', async (req: Request, res: Response) => {
  try {
    const { purchasedSlotId } = req.params;

    console.log('🔵 通話ステータス取得:', purchasedSlotId);

    // purchased_slotsとcall_slotsを取得
    const { data: purchasedSlot, error: fetchError } = await supabase
      .from('purchased_slots')
      .select(`
        *,
        call_slots (
          scheduled_start_time,
          duration_minutes
        )
      `)
      .eq('id', purchasedSlotId)
      .single();

    if (fetchError || !purchasedSlot) {
      return res.status(404).json({ error: '通話情報が見つかりません' });
    }

    const callSlot = Array.isArray(purchasedSlot.call_slots) 
      ? purchasedSlot.call_slots[0] 
      : purchasedSlot.call_slots;

    // 時刻計算
    const scheduledTime = new Date(callSlot.scheduled_start_time);
    const now = new Date();
    const timeUntilStartSeconds = Math.floor((scheduledTime.getTime() - now.getTime()) / 1000);
    // 開始時刻になったら通話開始可能（0秒以下）
    const canJoin = timeUntilStartSeconds <= 0;

    console.log('🔵 ステータス情報:', {
      timeUntilStartSeconds,
      canJoin,
      influencer_joined: !!purchasedSlot.influencer_joined_at,
      fan_joined: !!purchasedSlot.fan_joined_at,
    });

    res.json({
      status: purchasedSlot.call_status,
      scheduled_start_time: callSlot.scheduled_start_time,
      duration_minutes: callSlot.duration_minutes,
      time_until_start_seconds: Math.max(0, timeUntilStartSeconds),
      participants: {
        influencer_joined: !!purchasedSlot.influencer_joined_at,
        fan_joined: !!purchasedSlot.fan_joined_at,
      },
      can_join: canJoin,
      room_created: !!purchasedSlot.video_call_room_id,
    });

  } catch (error: any) {
    console.error('❌ 通話ステータス取得エラー:', error);
    res.status(500).json({ error: error.message || 'ステータス取得に失敗しました' });
  }
});

  return router;
};

export default createCallsRouter;

