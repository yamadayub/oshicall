// Daily.co Webhookエンドポイント
import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { captureTalkPayment } from '../services/paymentCapture';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const createDailyWebhookRouter = (supabase: any) => {
  const router = Router();

  /**
   * POST /webhook
   * Daily.coからのWebhookを受信してイベントログを保存
   */
  router.post('/webhook', async (req: Request, res: Response) => {
    try {
      const event = req.body;

      console.log('🔵 Daily.co Webhook受信:', {
        type: event.type,
        room: event.room?.name,
        participant: event.participant?.user_id,
        timestamp: event.timestamp
      });

      // roomNameからpurchased_slot_idを特定
      const roomName = event.room?.name;
      if (!roomName) {
        console.warn('⚠️ roomNameが含まれていません');
        return res.status(200).json({ received: true });
      }

      // roomNameは "call-{purchased_slot_id}" の形式
      const purchasedSlotId = roomName.replace('call-', '');

      const { data: purchasedSlot, error: slotError } = await supabase
        .from('purchased_slots')
        .select('id, influencer_user_id, fan_user_id')
        .eq('video_call_room_id', roomName)
        .single();

      if (slotError || !purchasedSlot) {
        console.warn('⚠️ ルームに紐づくpurchased_slotが見つかりません:', roomName);
        return res.status(200).json({ received: true });
      }

      // user_idの特定
      let userId: string | null = null;
      if (event.participant?.user_id) {
        userId = event.participant.user_id;
      }

      // イベントデータの準備
      const eventData: any = {
        purchased_slot_id: purchasedSlot.id,
        event_type: event.type,
        user_id: userId,
        participant_id: event.participant?.participant_id || null,
        event_data: event,
        created_at: event.timestamp || new Date().toISOString()
      };

      // room-endedイベントの場合、終了理由を保存
      if (event.type === 'room.ended' || event.type === 'meeting.ended') {
        // Daily.coの自動終了判定
        // expiredAt が存在する場合は規定時間経過による自動終了
        const reason = event.end_reason ||
                      (event.expired_at ? 'duration' : 'manual');
        eventData.room_end_reason = reason;

        console.log('🔵 ルーム終了イベント:', {
          room: roomName,
          reason,
          expired_at: event.expired_at
        });
      }

      // イベントログを保存
      const { error: insertError } = await supabase
        .from('daily_call_events')
        .insert(eventData);

      if (insertError) {
        console.error('❌ イベント保存エラー:', insertError);
        throw insertError;
      }

      console.log('✅ Daily.coイベント保存成功:', {
        type: event.type,
        purchased_slot_id: purchasedSlot.id
      });

      // room-endedイベントの場合、決済処理をトリガー
      if (event.type === 'room.ended' || event.type === 'meeting.ended') {
        console.log('🔵 決済処理をトリガー:', purchasedSlot.id);

        // 非同期で決済処理を実行（Webhookレスポンスは即座に返す）
        processTalkPayment(supabase, purchasedSlot.id).catch(error => {
          console.error('❌ 決済処理エラー:', error);
        });
      }

      res.status(200).json({ received: true });

    } catch (error: any) {
      console.error('❌ Daily.co Webhook処理エラー:', error);
      // Webhookは常に200を返す（Daily.coの再送を防ぐため）
      res.status(200).json({ received: true, error: error.message });
    }
  });

  /**
   * POST /api/daily/process-payment/:purchasedSlotId
   * 手動で決済処理を実行（デバッグ用・緊急対応用）
   */
  router.post('/process-payment/:purchasedSlotId', async (req: Request, res: Response) => {
    try {
      const { purchasedSlotId } = req.params;

      console.log('🔵 手動決済処理開始:', purchasedSlotId);

      // 非同期で決済処理を実行
      processTalkPayment(supabase, purchasedSlotId)
        .then(() => {
          console.log('✅ 手動決済処理完了:', purchasedSlotId);
        })
        .catch(error => {
          console.error('❌ 手動決済処理エラー:', error);
        });

      // 即座にレスポンスを返す（非同期処理のため）
      res.status(200).json({
        success: true,
        message: '決済処理を開始しました',
        purchasedSlotId
      });

    } catch (error: any) {
      console.error('❌ 手動決済処理エラー:', error);
      res.status(500).json({
        error: error.message || '決済処理の開始に失敗しました'
      });
    }
  });

  return router;
};

/**
 * Talk終了後の決済処理
 * room-endedイベント受信時に非同期で実行
 * 手動実行用にもエクスポート
 */
export async function processTalkPayment(supabase: any, purchasedSlotId: string) {
  console.log('🔵 processTalkPayment開始:', purchasedSlotId);
  try {
    console.log('🔵 Talk決済処理開始:', purchasedSlotId);

    // purchased_slotとbid情報を取得
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
      return;
    }

    // 既に決済済みかチェック（Transfer処理の有無も確認）
    const { data: existingPayment } = await supabase
      .from('payment_transactions')
      .select('id, stripe_transfer_id, stripe_payment_intent_id')
      .eq('purchased_slot_id', purchasedSlotId)
      .maybeSingle();

    if (existingPayment) {
      console.log('⚠️ 既に決済済み:', purchasedSlotId);
      
      // Transfer処理が未実行の場合、実行する
      if (!existingPayment.stripe_transfer_id || existingPayment.stripe_transfer_id === 'auto_split') {
        // auto_splitはDestination Charges方式のマーカーなのでスキップ
        if (existingPayment.stripe_transfer_id === 'auto_split') {
          console.log('✅ Destination Charges方式: 自動分割済み（Transfer処理不要）');
          return;
        }
        
        // Direct Charges方式でTransfer未実行の場合、実行する
        console.log('🔵 Transfer処理が未実行のため実行します:', purchasedSlotId);
        
        const paymentIntentId = existingPayment.stripe_payment_intent_id;
        if (!paymentIntentId) {
          console.error('❌ PaymentIntent IDが取得できません');
          return;
        }

        // PaymentIntentを取得してDestination Charges方式かどうかを確認
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
          
          // Destination Charges方式の場合はスキップ
          if (paymentIntent.application_fee_amount) {
            console.log('✅ Destination Charges方式: 自動分割済み（Transfer処理不要）');
            // auto_splitマーカーを設定
            await supabase
              .from('payment_transactions')
              .update({ stripe_transfer_id: 'auto_split' })
              .eq('id', existingPayment.id);
            return;
          }

          // Direct Charges方式: Transfer処理を実行
          const { data: purchasedSlotForTransfer } = await supabase
            .from('purchased_slots')
            .select('influencer_user_id, auction_id, winning_bid_amount')
            .eq('id', purchasedSlotId)
            .single();

          if (!purchasedSlotForTransfer) {
            console.error('❌ purchased_slot取得エラー（Transfer処理用）');
            return;
          }

          const { data: influencer } = await supabase
            .from('users')
            .select('stripe_connect_account_id')
            .eq('id', purchasedSlotForTransfer.influencer_user_id)
            .single();

          if (!influencer?.stripe_connect_account_id) {
            console.warn('⚠️ stripe_connect_account_id未登録のためTransferスキップ');
            return;
          }

          // payment_transactionsからinfluencer_payoutを取得
          const { data: paymentTx } = await supabase
            .from('payment_transactions')
            .select('influencer_payout')
            .eq('id', existingPayment.id)
            .single();

          if (!paymentTx?.influencer_payout) {
            console.error('❌ influencer_payoutが取得できません');
            return;
          }

          // Transferを実行
          const transfer = await stripe.transfers.create({
            amount: Math.round(paymentTx.influencer_payout),
            currency: 'jpy',
            destination: influencer.stripe_connect_account_id,
            transfer_group: purchasedSlotForTransfer.auction_id || purchasedSlotId,
          });

          console.log('✅ Stripe Transfer作成成功:', transfer.id);

          // stripe_transfer_idを更新
          const { error: updateError } = await supabase
            .from('payment_transactions')
            .update({ stripe_transfer_id: transfer.id })
            .eq('id', existingPayment.id);

          if (updateError) {
            console.error('❌ payment_transactions更新エラー:', updateError);
          } else {
            console.log('✅ payment_transactions更新成功（Transfer ID記録）');
          }
        } catch (error: any) {
          console.error('❌ Transfer処理エラー:', error);
        }
      } else {
        console.log('✅ Transfer処理は既に完了済み');
      }
      return;
    }

    // auction_idからbid情報を取得（なければpurchased_slotsのpayment_intentを使用）
    const { data: bid, error: bidError } = await supabase
      .from('bids')
      .select('*')
      .eq('auction_id', purchasedSlot.auction_id)
      .eq('user_id', purchasedSlot.fan_user_id)
      .order('bid_amount', { ascending: false })
      .limit(1)
      .single();

    const paymentIntentId =
      bid?.stripe_payment_intent_id ||
      purchasedSlot.stripe_payment_intent_id;

    const bidAmount =
      bid?.bid_amount ||
      purchasedSlot.winning_bid_amount;

    if (bidError && !paymentIntentId) {
      console.error('❌ bid情報取得エラー:', bidError);
    }

    if (!paymentIntentId || !bidAmount) {
      console.error('❌ 決済に必要な情報が不足: paymentIntentIdまたは金額がありません');
      return;
    }

    console.log('🔵 決済判定・実行:', {
      purchased_slot_id: purchasedSlotId,
      payment_intent: paymentIntentId,
      bid_amount: bidAmount
    });

    // 決済判定と実行
    const result = await captureTalkPayment(
      supabase,
      purchasedSlotId,
      paymentIntentId,
      bidAmount
    );

    if (result.success) {
      console.log('✅ Talk決済成功:', result.message);

      // ユーザー統計を更新
      await supabase.rpc('update_user_statistics', {
        p_fan_id: purchasedSlot.fan_user_id,
        p_influencer_id: purchasedSlot.influencer_user_id,
        p_amount: bidAmount
      }).catch((err: any) => {
        console.warn('⚠️ ユーザー統計更新エラー（継続）:', err);
      });

    } else {
      console.log('⚠️ Talk決済スキップ:', result.message);
    }

  } catch (error: any) {
    console.error('❌ processTalkPayment エラー:', error);
    // エラーをログに記録するが、処理は続行
  }
}
