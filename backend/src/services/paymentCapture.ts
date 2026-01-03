// Talk完了判定と決済処理ロジック
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

interface TalkCompletionCheck {
  shouldCapture: boolean;
  reason: string;
  influencerParticipated: boolean;
  completedProperly: boolean;
}

/**
 * Talkが正常に完了したかを判定
 *
 * 課金条件（すべて満たす必要がある）:
 * 1. インフルエンサーが参加した（participant.joinedイベントが存在）
 * 2. Daily.coルームが「規定時間経過による自動終了」になった（room_end_reason === 'duration'）
 * 3. インフルエンサーが予定開始時刻から予定終了時刻まで途中退室なしで参加した
 *    - 予定開始時刻より前に参加している場合はOK（待機室からの参加）
 *    - 予定開始時刻より後に参加した場合はNG（最初から参加していない）
 *    - 予定終了時刻まで参加している必要がある
 *
 * 注意: Call slotの開始時刻と終了時刻が守られるべきで、
 *       両者が参加してからXX分間という仕様ではない
 *
 * @param supabase Supabaseクライアント
 * @param purchasedSlotId purchased_slotsのID
 * @returns 判定結果
 */
export async function shouldCaptureTalkPayment(
  supabase: any,
  purchasedSlotId: string
): Promise<TalkCompletionCheck> {

  console.log('🔵 決済判定開始:', purchasedSlotId);

  // 1. Talk情報とイベントログを取得
  const { data: purchasedSlot, error: slotError } = await supabase
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

  if (slotError || !purchasedSlot) {
    console.error('❌ purchased_slot取得エラー:', slotError);
    return {
      shouldCapture: false,
      reason: 'purchased_slot_not_found',
      influencerParticipated: false,
      completedProperly: false
    };
  }

  const callSlot = Array.isArray(purchasedSlot.call_slots)
    ? purchasedSlot.call_slots[0]
    : purchasedSlot.call_slots;

  if (!callSlot || !callSlot.scheduled_start_time) {
    console.error('❌ call_slots情報が不足');
    return {
      shouldCapture: false,
      reason: 'call_slot_info_missing',
      influencerParticipated: false,
      completedProperly: false
    };
  }

  const { data: events, error: eventsError } = await supabase
    .from('daily_call_events')
    .select('*')
    .eq('purchased_slot_id', purchasedSlotId)
    .order('created_at', { ascending: true });

  if (eventsError) {
    console.error('❌ イベント取得エラー:', eventsError);
    return {
      shouldCapture: false,
      reason: 'failed_to_fetch_events',
      influencerParticipated: false,
      completedProperly: false
    };
  }

  console.log('🔵 イベント数:', events?.length || 0);

  // ハイブリッド判定: イベントログがない場合は purchased_slots の情報で判定
  if (!events || events.length === 0) {
    console.warn('⚠️ イベントログが存在しないため、purchased_slots情報で判定します');
    return shouldCaptureTalkPaymentFromPurchasedSlot(purchasedSlot, callSlot);
  }

  // 2. インフルエンサーが参加したかチェック（イベントログベースの厳密な判定）
  const influencerJoined = events.some((e: any) =>
    (e.event_type === 'participant.joined') &&
    (e.user_id === purchasedSlot.influencer_user_id)
  );

  console.log('🔵 インフルエンサー参加:', influencerJoined);

  if (!influencerJoined) {
    console.warn('⚠️ インフルエンサー不参加（no-show）');
    return {
      shouldCapture: false,
      reason: 'influencer_no_show',
      influencerParticipated: false,
      completedProperly: false
    };
  }

  // 3. Daily.coが「自動終了」したかチェック
  const roomEndedByDuration = events.some((e: any) =>
    (e.event_type === 'room.ended' || e.event_type === 'meeting.ended') &&
    (e.room_end_reason === 'duration')
  );

  console.log('🔵 規定時間による自動終了:', roomEndedByDuration);

  if (!roomEndedByDuration) {
    console.warn('⚠️ 規定時間満了前に終了');
    return {
      shouldCapture: false,
      reason: 'room_not_ended_by_duration',
      influencerParticipated: true,
      completedProperly: false
    };
  }

  // 4. インフルエンサーが既定時間の最初から最後まで途中退室なしで参加したかチェック
  const scheduledStartTime = new Date(callSlot.scheduled_start_time);
  const scheduledEndTime = new Date(scheduledStartTime.getTime() + callSlot.duration_minutes * 60 * 1000);
  
  const stayedFromStartToEnd = hasInfluencerStayedFromStartToEnd(
    events,
    purchasedSlot.influencer_user_id,
    scheduledStartTime,
    scheduledEndTime
  );

  console.log('🔵 インフルエンサー連続参加:', stayedFromStartToEnd);

  if (!stayedFromStartToEnd) {
    console.warn('⚠️ インフルエンサーが既定時間の最初から最後まで参加していない');
    return {
      shouldCapture: false,
      reason: 'influencer_left_during_talk',
      influencerParticipated: true,
      completedProperly: false
    };
  }

  // 5. すべての条件を満たした → 課金OK
  console.log('✅ 課金条件をすべて満たしました');
  return {
    shouldCapture: true,
    reason: 'completed_successfully',
    influencerParticipated: true,
    completedProperly: true
  };
}

/**
 * purchased_slotsテーブルの情報から決済判定を行う（Webhookイベントログがない場合）
 * 
 * 判定条件:
 * 1. インフルエンサーが参加した（influencer_joined_at !== null）
 * 2. 開始時刻前に参加（influencer_joined_at <= scheduled_start_time）
 * 3. 予定終了時刻まで留まっている（call_ended_at >= scheduled_end_time）
 * 4. 途中退室の概算判定（call_actual_duration_minutes >= duration_minutes）
 * 
 * @param purchasedSlot purchased_slotsレコード
 * @param callSlot call_slotsレコード
 * @returns 判定結果
 */
function shouldCaptureTalkPaymentFromPurchasedSlot(
  purchasedSlot: any,
  callSlot: any
): TalkCompletionCheck {
  console.log('🔵 purchased_slots情報で決済判定開始');

  // 1. インフルエンサーが参加したかチェック
  if (!purchasedSlot.influencer_joined_at) {
    console.warn('⚠️ インフルエンサー不参加（no-show）');
    return {
      shouldCapture: false,
      reason: 'influencer_no_show',
      influencerParticipated: false,
      completedProperly: false
    };
  }

  const scheduledStartTime = new Date(callSlot.scheduled_start_time);
  const scheduledEndTime = new Date(scheduledStartTime.getTime() + callSlot.duration_minutes * 60 * 1000);
  const influencerJoinedAt = new Date(purchasedSlot.influencer_joined_at);

  // 2. 開始時刻前に参加しているかチェック
  if (influencerJoinedAt > scheduledStartTime) {
    console.warn('⚠️ インフルエンサーが予定開始時刻より後に参加:', {
      influencerJoinedAt: influencerJoinedAt.toISOString(),
      scheduledStartTime: scheduledStartTime.toISOString()
    });
    return {
      shouldCapture: false,
      reason: 'influencer_joined_after_start',
      influencerParticipated: true,
      completedProperly: false
    };
  }

  // 3. 通話終了時刻が記録されているかチェック
  if (!purchasedSlot.call_ended_at) {
    console.warn('⚠️ 通話終了時刻が記録されていません');
    return {
      shouldCapture: false,
      reason: 'call_end_time_not_recorded',
      influencerParticipated: true,
      completedProperly: false
    };
  }

  const callEndedAt = new Date(purchasedSlot.call_ended_at);

  // 4. 予定終了時刻まで留まっているかチェック
  if (callEndedAt < scheduledEndTime) {
    console.warn('⚠️ 予定終了時刻より前に終了:', {
      callEndedAt: callEndedAt.toISOString(),
      scheduledEndTime: scheduledEndTime.toISOString()
    });
    return {
      shouldCapture: false,
      reason: 'ended_before_scheduled_end',
      influencerParticipated: true,
      completedProperly: false
    };
  }

  // 5. 途中退室の概算判定（実際の通話時間が予定時間以上か）
  const actualDuration = purchasedSlot.call_actual_duration_minutes || 0;
  if (actualDuration < callSlot.duration_minutes) {
    console.warn('⚠️ 実際の通話時間が予定時間より短い:', {
      actualDuration,
      scheduledDuration: callSlot.duration_minutes
    });
    return {
      shouldCapture: false,
      reason: 'actual_duration_less_than_scheduled',
      influencerParticipated: true,
      completedProperly: false
    };
  }

  // 6. すべての条件を満たした → 課金OK
  console.log('✅ purchased_slots情報による課金条件をすべて満たしました');
  return {
    shouldCapture: true,
    reason: 'completed_successfully',
    influencerParticipated: true,
    completedProperly: true
  };
}

/**
 * インフルエンサーが予定開始時刻から予定終了時刻まで途中退室なしで参加したかチェック
 * 
 * 判定条件:
 * 1. 最初の参加時刻が予定開始時刻より前または同じ（予定開始時刻より後の参加は不可）
 * 2. 予定終了時刻まで参加していた（退出イベントがない、または予定終了時刻以降に退出）
 * 
 * @param events イベントログ配列
 * @param influencerUserId インフルエンサーのユーザーID
 * @param scheduledStartTime 予定開始時刻（Call slotの開始時刻）
 * @param scheduledEndTime 予定終了時刻（Call slotの終了時刻）
 * @returns true: 予定開始時刻から予定終了時刻まで参加、false: 条件未満足
 */
function hasInfluencerStayedFromStartToEnd(
  events: any[],
  influencerUserId: string,
  scheduledStartTime: Date,
  scheduledEndTime: Date
): boolean {

  // 1. インフルエンサーの参加イベントを探す
  const influencerJoinedEvents = events.filter(e =>
    e.event_type === 'participant.joined' &&
    e.user_id === influencerUserId
  );

  if (influencerJoinedEvents.length === 0) {
    // 参加イベントがない = 参加していない
    return false;
  }

  // 最初の参加時刻を取得（開始時刻前の参加も許可）
  const firstJoinTime = new Date(
    influencerJoinedEvents.reduce((earliest, e) => {
      const eventTime = new Date(e.created_at);
      return eventTime < earliest ? eventTime : earliest;
    }, new Date(influencerJoinedEvents[0].created_at))
  );

  // 2. インフルエンサーの退出イベントを探す
  const influencerLeftEvents = events.filter(e =>
    e.event_type === 'participant.left' &&
    e.user_id === influencerUserId
  );

  // 3. ルーム終了イベントを探す
  const roomEndEvent = events.find(e =>
    e.event_type === 'room.ended' || e.event_type === 'meeting.ended'
  );

  if (!roomEndEvent) {
    // 終了イベントがない場合は判定できない（false = 途中退室あり扱い）
    return false;
  }

  const roomEndTime = new Date(roomEndEvent.created_at);

  // 4. 最初の参加時刻が予定開始時刻より後なら、最初から参加していない
  if (firstJoinTime > scheduledStartTime) {
    console.log('⚠️ インフルエンサーが予定開始時刻より後に参加:', {
      firstJoinTime: firstJoinTime.toISOString(),
      scheduledStartTime: scheduledStartTime.toISOString()
    });
    return false;
  }

  // 5. 退出イベントがない場合 = 最後まで参加していた
  if (influencerLeftEvents.length === 0) {
    // 予定開始時刻から予定終了時刻まで参加していたか確認
    // 開始時刻前に入室している場合は予定開始時刻からカウント
    // 終了時刻まで参加していたか
    return roomEndTime >= scheduledEndTime;
  }

  // 6. 退出イベントがある場合、予定開始時刻から予定終了時刻までの間に退出していないか確認
  const lastLeftTime = influencerLeftEvents.reduce((latest, e) => {
    const eventTime = new Date(e.created_at);
    return eventTime > latest ? eventTime : latest;
  }, new Date(influencerLeftEvents[0].created_at));

  // 予定開始時刻から予定終了時刻までの間に退出していないか
  // 予定終了時刻より後に退出した場合は問題なし（正常終了）
  if (lastLeftTime < scheduledEndTime) {
    // 予定終了時刻より前に退出 = 途中退室
    return false;
  }

  // 予定終了時刻以降に退出 = 正常終了（最後まで参加）
  return true;
}

/**
 * Talk完了後の決済を実行
 *
 * @param supabase Supabaseクライアント
 * @param purchasedSlotId purchased_slotsのID
 * @param paymentIntentId Stripe PaymentIntent ID
 * @param bidAmount 入札額
 * @returns 決済結果
 */
export async function captureTalkPayment(
  supabase: any,
  purchasedSlotId: string,
  paymentIntentId: string,
  bidAmount: number
): Promise<{ success: boolean; message: string; capturedPayment?: any }> {

  try {
    console.log('🔵 決済capture開始:', { purchasedSlotId, paymentIntentId, bidAmount });

    // 1. 決済判定
    const captureCheck = await shouldCaptureTalkPayment(supabase, purchasedSlotId);

    if (!captureCheck.shouldCapture) {
      console.log('⚠️ 決済条件を満たしていません:', captureCheck.reason);

      // PaymentIntentをキャンセル
      try {
        await stripe.paymentIntents.cancel(paymentIntentId);
        console.log('✅ PaymentIntent キャンセル成功:', paymentIntentId);
      } catch (cancelError: any) {
        console.warn('⚠️ PaymentIntent キャンセル失敗:', cancelError.message);
      }

      // purchased_slotsのステータスを更新
      await supabase
        .from('purchased_slots')
        .update({
          call_status: 'cancelled',
          call_ended_at: new Date().toISOString()
        })
        .eq('id', purchasedSlotId);

      return {
        success: false,
        message: `決済スキップ: ${captureCheck.reason}`
      };
    }

    // 2. Payment Intentの状態を確認
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    let capturedPayment = paymentIntent;
    let isAlreadyCaptured = false;

    if (paymentIntent.status === 'succeeded') {
      console.log('⚠️ 既に決済済み:', paymentIntentId);
      isAlreadyCaptured = true;
      // 既に決済済みでも送金処理は実行する
    } else if (paymentIntent.status !== 'requires_capture') {
      console.warn('⚠️ キャプチャ不可能な状態:', paymentIntent.status);
      return {
        success: false,
        message: `キャプチャ不可能: ${paymentIntent.status}`
      };
    } else {
      // 3. 決済を確定（capture）
      console.log('🔵 PaymentIntent Capture実行:', paymentIntentId);
      capturedPayment = await stripe.paymentIntents.capture(paymentIntentId);
      console.log('✅ 決済確定成功:', capturedPayment.id);
    }

    // 4. プラットフォーム手数料計算（20%）
    const platformFee = Math.round(bidAmount * 0.2);
    const influencerPayout = bidAmount - platformFee;

    // 5. payment_transactionsに記録（既に存在する場合はスキップ）
    // 既に記録されているかチェック（決済済みの場合でもチェック）
    const chargeId = capturedPayment.latest_charge
      ? (typeof capturedPayment.latest_charge === 'string'
          ? capturedPayment.latest_charge
          : capturedPayment.latest_charge.id)
      : null;

    const { data: existingPayment } = await supabase
      .from('payment_transactions')
      .select('id, stripe_transfer_id')
      .eq('stripe_payment_intent_id', capturedPayment.id)
      .maybeSingle();

    if (!existingPayment) {
      // payment_transactionsが存在しない場合は作成（決済済みの場合でも）
      console.log('🔵 payment_transactionsを作成:', { purchasedSlotId, paymentIntentId: capturedPayment.id });
      const { error: paymentError } = await supabase
        .from('payment_transactions')
        .insert({
          purchased_slot_id: purchasedSlotId,
          stripe_payment_intent_id: capturedPayment.id,
          stripe_charge_id: chargeId,
          amount: bidAmount,
          platform_fee: platformFee,
          influencer_payout: influencerPayout,
          status: isAlreadyCaptured ? 'captured' : 'captured'
        });

      if (paymentError) {
        console.error('❌ payment_transactions記録エラー:', paymentError);
        throw paymentError;
      }
      console.log('✅ payment_transactions作成成功');
    } else {
      console.log('ℹ️ payment_transactionsは既に記録済み:', {
        id: existingPayment.id,
        stripe_transfer_id: existingPayment.stripe_transfer_id
      });
    }

    // 5.5 インフルエンサーへの送金（Stripe Connect）
    // 既に決済済みの場合でも送金処理を実行（送金が未実行の場合）
    try {
      console.log('🔵 インフルエンサー送金処理開始:', { purchasedSlotId, influencerPayout });
      
      // 既に送金済みかチェック（payment_transactionsは上記で作成済みまたは既存）
      const { data: paymentRecord } = await supabase
        .from('payment_transactions')
        .select('stripe_transfer_id')
        .eq('stripe_payment_intent_id', capturedPayment.id)
        .maybeSingle();

      if (paymentRecord?.stripe_transfer_id) {
        console.log('ℹ️ 既に送金済み:', paymentRecord.stripe_transfer_id);
      } else {
        const { data: slotForTransfer, error: slotError } = await supabase
          .from('purchased_slots')
          .select('influencer_user_id, auction_id')
          .eq('id', purchasedSlotId)
          .single();

        if (slotError || !slotForTransfer) {
          console.error('❌ purchased_slots取得エラー:', slotError);
          console.warn('⚠️ purchased_slotsが取得できず送金スキップ');
        } else if (slotForTransfer.influencer_user_id) {
          console.log('🔵 インフルエンサー情報取得:', { influencer_user_id: slotForTransfer.influencer_user_id });
          
          const { data: influencer, error: influencerError } = await supabase
            .from('users')
            .select('stripe_connect_account_id')
            .eq('id', slotForTransfer.influencer_user_id)
            .single();

          if (influencerError) {
            console.error('❌ インフルエンサー情報取得エラー:', influencerError);
            console.warn('⚠️ インフルエンサー情報が取得できず送金スキップ');
          } else if (influencer?.stripe_connect_account_id) {
            console.log('🔵 Stripe Transfer作成開始:', {
              amount: Math.round(influencerPayout),
              destination: influencer.stripe_connect_account_id,
              currency: 'jpy'
            });
            
            const transfer = await stripe.transfers.create({
              amount: Math.round(influencerPayout),
              currency: 'jpy',
              destination: influencer.stripe_connect_account_id,
              transfer_group: slotForTransfer.auction_id || purchasedSlotId,
            });

            console.log('✅ Stripe Transfer作成成功:', transfer.id);

            const { error: updateError } = await supabase
              .from('payment_transactions')
              .update({ stripe_transfer_id: transfer.id })
              .eq('stripe_payment_intent_id', capturedPayment.id);

            if (updateError) {
              console.error('❌ payment_transactions更新エラー:', updateError);
            } else {
              console.log('✅ インフルエンサー送金成功:', transfer.id);
            }
          } else {
            console.warn('⚠️ stripe_connect_account_id未登録のため送金スキップ:', {
              influencer_user_id: slotForTransfer.influencer_user_id,
              stripe_connect_account_id: influencer?.stripe_connect_account_id
            });
          }
        } else {
          console.warn('⚠️ influencer_user_idが取得できず送金スキップ');
        }
      }
    } catch (transferError: any) {
      console.error('❌ インフルエンサー送金エラー:', {
        error: transferError.message,
        stack: transferError.stack,
        purchasedSlotId,
        influencerPayout
      });
      // 決済は確定済みのため送金のみ失敗としてログに残す
    }

    // 6. purchased_slotsのステータスを更新
    await supabase
      .from('purchased_slots')
      .update({
        call_status: 'completed',
        call_ended_at: new Date().toISOString()
      })
      .eq('id', purchasedSlotId);

    console.log('✅ Talk決済処理完了:', purchasedSlotId);

    return {
      success: true,
      message: '決済成功',
      capturedPayment
    };

  } catch (error: any) {
    console.error('❌ captureTalkPayment エラー:', error);
    throw error;
  }
}
