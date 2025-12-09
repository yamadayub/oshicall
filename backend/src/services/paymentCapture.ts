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
 * 課金条件:
 * 1. インフルエンサーが参加した
 * 2. Daily.coルームが「規定時間経過による自動終了」になった
 * 3. インフルエンサーが途中退出していない
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

  if (!events || events.length === 0) {
    console.warn('⚠️ イベントログが存在しません');
    return {
      shouldCapture: false,
      reason: 'no_events',
      influencerParticipated: false,
      completedProperly: false
    };
  }

  // 2. インフルエンサーが参加したかチェック
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

  // 4. インフルエンサーが途中退出していないかチェック
  const influencerLeftEarly = hasInfluencerLeftBeforeRoomEnd(
    events,
    purchasedSlot.influencer_user_id
  );

  console.log('🔵 インフルエンサー途中退出:', influencerLeftEarly);

  if (influencerLeftEarly) {
    console.warn('⚠️ インフルエンサーが途中退出');
    return {
      shouldCapture: false,
      reason: 'influencer_left_early',
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
 * インフルエンサーが自動終了前に退出したかチェック
 */
function hasInfluencerLeftBeforeRoomEnd(
  events: any[],
  influencerUserId: string
): boolean {

  // room-endedイベントを探す
  const roomEndEvent = events.find(e =>
    e.event_type === 'room.ended' || e.event_type === 'meeting.ended'
  );

  if (!roomEndEvent) {
    // 終了イベントがない場合は判定できない（false = 退出していない扱い）
    return false;
  }

  const roomEndTime = new Date(roomEndEvent.created_at);

  // インフルエンサーのleftイベントを探す
  const influencerLeftEvent = events.find(e =>
    e.event_type === 'participant.left' &&
    e.user_id === influencerUserId
  );

  if (!influencerLeftEvent) {
    // 退出イベントがない = 最後までいた
    return false;
  }

  const leftTime = new Date(influencerLeftEvent.created_at);

  // 終了前に退出していたらtrue
  return leftTime < roomEndTime;
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

    if (paymentIntent.status === 'succeeded') {
      console.log('⚠️ 既に決済済み:', paymentIntentId);
      return {
        success: true,
        message: '既に決済済み',
        capturedPayment: paymentIntent
      };
    }

    if (paymentIntent.status !== 'requires_capture') {
      console.warn('⚠️ キャプチャ不可能な状態:', paymentIntent.status);
      return {
        success: false,
        message: `キャプチャ不可能: ${paymentIntent.status}`
      };
    }

    // 3. 決済を確定（capture）
    console.log('🔵 PaymentIntent Capture実行:', paymentIntentId);
    const capturedPayment = await stripe.paymentIntents.capture(paymentIntentId);
    console.log('✅ 決済確定成功:', capturedPayment.id);

    // 4. プラットフォーム手数料計算（20%）
    const platformFee = Math.round(bidAmount * 0.2);
    const influencerPayout = bidAmount - platformFee;

    // 5. payment_transactionsに記録
    const chargeId = capturedPayment.latest_charge
      ? (typeof capturedPayment.latest_charge === 'string'
          ? capturedPayment.latest_charge
          : capturedPayment.latest_charge.id)
      : null;

    const { error: paymentError } = await supabase
      .from('payment_transactions')
      .insert({
        purchased_slot_id: purchasedSlotId,
        stripe_payment_intent_id: capturedPayment.id,
        stripe_charge_id: chargeId,
        amount: bidAmount,
        platform_fee: platformFee,
        influencer_payout: influencerPayout,
        status: 'captured'
      });

    if (paymentError) {
      console.error('❌ payment_transactions記録エラー:', paymentError);
      throw paymentError;
    }

    // 5.5 インフルエンサーへの送金（Stripe Connect）
    try {
      const { data: slotForTransfer } = await supabase
        .from('purchased_slots')
        .select('influencer_user_id, auction_id')
        .eq('id', purchasedSlotId)
        .single();

      if (slotForTransfer?.influencer_user_id) {
        const { data: influencer } = await supabase
          .from('users')
          .select('stripe_account_id')
          .eq('id', slotForTransfer.influencer_user_id)
          .single();

        if (influencer?.stripe_account_id) {
          const transfer = await stripe.transfers.create({
            amount: Math.round(influencerPayout),
            currency: 'jpy',
            destination: influencer.stripe_account_id,
            transfer_group: slotForTransfer.auction_id || purchasedSlotId,
          });

          await supabase
            .from('payment_transactions')
            .update({ stripe_transfer_id: transfer.id })
            .eq('stripe_payment_intent_id', capturedPayment.id);

          console.log('✅ インフルエンサー送金成功:', transfer.id);
        } else {
          console.warn('⚠️ stripe_account_id未登録のため送金スキップ');
        }
      } else {
        console.warn('⚠️ purchased_slotsが取得できず送金スキップ');
      }
    } catch (transferError: any) {
      console.error('❌ インフルエンサー送金エラー:', transferError);
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
