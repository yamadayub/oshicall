import express, { Request, Response } from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { createCallsRouter } from './routes/calls';
import { createDailyAdminRouter } from './routes/dailyAdmin';
import { createDailyWebhookRouter } from './routes/dailyWebhook';
import influencerApplicationRouter from './routes/influencerApplication';
import cron from 'node-cron';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Stripe初期化
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Supabase初期化（Service Role Key使用）
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// CORS設定
const getAllowedOrigins = () => {
  const origins: string[] = [];

  // 本番環境のドメイン
  origins.push('https://oshi-talk.com');
  origins.push('https://www.oshi-talk.com');
  origins.push('http://oshi-talk.com');
  origins.push('http://www.oshi-talk.com');

  // Staging環境のドメイン
  origins.push('https://staging.oshi-talk.com');

  // Heroku直接ドメイン（移行期間用）
  origins.push('https://oshicall-production-b6c5f1089a01.herokuapp.com');
  origins.push('https://oshicall-staging-3eced5376515.herokuapp.com');

  // 開発環境の場合はlocalhostも許可
  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:5173');
    origins.push('http://localhost:5174');
    origins.push('http://localhost:3000');
  }

  // 環境変数で追加のオリジンを指定可能
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }

  return origins;
};

const allowedOrigins = getAllowedOrigins();

console.log('🌐 CORS許可オリジン:', allowedOrigins);

// CORSミドルウェア（APIルートのみに適用）
const corsMiddleware = cors({
  origin: function (origin, callback) {
    // ブラウザからの直接ナビゲーション（GET /）ではoriginが undefined
    // これは正常な動作なので許可する
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('❌ CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
});

// APIルートにのみCORSを適用
app.use('/api', corsMiddleware);
app.use('/health', corsMiddleware);

// CSP ヘッダーを設定（環境に応じてSupabase URLを変更）
app.use((req, res, next) => {
  // 環境に応じたSupabase URLを設定
  const supabaseUrl = process.env.SUPABASE_URL || 'https://atkhwwqunwmpzqkgavtx.supabase.co';
  const supabaseDomain = supabaseUrl.replace('https://', '').split('.')[0];

  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://*.daily.co; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https: blob:; " +
    `connect-src 'self' https://${supabaseDomain}.supabase.co https://api.stripe.com https://*.daily.co wss://*.daily.co; ` +
    "frame-src 'self' https://js.stripe.com https://*.daily.co; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'"
  );
  next();
});

app.use(express.json());

// 静的ファイルの提供（本番環境のみ）
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../dist')));
}

// ============================================
// ルーター
// ============================================
const callsRouter = createCallsRouter(supabase);
const dailyAdminRouter = createDailyAdminRouter(supabase);
const dailyWebhookRouter = createDailyWebhookRouter(supabase);

app.use('/api/calls', callsRouter);
app.use('/api/daily-admin', dailyAdminRouter);
app.use('/api/daily', dailyWebhookRouter);
app.use('/api', influencerApplicationRouter);

// ============================================
// Stripe Customer作成
// ============================================
app.post('/api/stripe/create-customer', async (req: Request, res: Response) => {
  try {
    const { email, name, authUserId } = req.body;

    console.log('🔵 Stripe Customer作成開始:', { email, name, authUserId });

    const customer = await stripe.customers.create({
      email,
      name,
      metadata: { auth_user_id: authUserId },
    });

    console.log('✅ Stripe Customer作成成功:', customer.id);

    // Supabaseのusersテーブルを更新
    const { data, error } = await supabase
      .from('users')
      .update({ stripe_customer_id: customer.id })
      .eq('auth_user_id', authUserId)
      .select();

    if (error) {
      console.error('❌ Supabase更新エラー:', error);
      throw error;
    }

    console.log('✅ Supabase更新成功:', data);

    res.json({ customerId: customer.id });
  } catch (error: any) {
    console.error('Customer作成エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SetupIntent作成（カード登録用）
// ============================================
app.post('/api/stripe/create-setup-intent', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.body;

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session', // オフセッション決済を許可
    });

    res.json({ clientSecret: setupIntent.client_secret });
  } catch (error: any) {
    console.error('SetupIntent作成エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// デフォルト支払い方法を設定
// ============================================
app.post('/api/stripe/set-default-payment-method', async (req: Request, res: Response) => {
  try {
    const { customerId, paymentMethodId } = req.body;

    // デフォルト支払い方法を設定
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('デフォルト支払い方法設定エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// カード登録完了後の処理
// ============================================
app.post('/api/stripe/confirm-payment-method', async (req: Request, res: Response) => {
  try {
    const { authUserId } = req.body;

    console.log('🔵 カード登録確認開始:', { authUserId });

    // usersテーブルを更新（Service Role Keyで実行）
    const { data, error } = await supabase
      .from('users')
      .update({ has_payment_method: true })
      .eq('auth_user_id', authUserId)
      .select();

    if (error) {
      console.error('❌ Supabase更新エラー:', error);
      throw error;
    }

    console.log('✅ has_payment_method更新成功:', data);

    res.json({ success: true, updatedUser: data });
  } catch (error: any) {
    console.error('カード登録確認エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 与信確保（入札時）
// ============================================
app.post('/api/stripe/authorize-payment', async (req: Request, res: Response) => {
  try {
    const { amount, customerId, auctionId, userId } = req.body;

    console.log('🔵 与信確保開始:', { amount, customerId, auctionId, userId });

    // 1. 前回の最高入札を取得
    const { data: previousBids, error: previousBidsError } = await supabase
      .from('bids')
      .select('id, stripe_payment_intent_id, user_id')
      .eq('auction_id', auctionId)
      .order('bid_amount', { ascending: false })
      .limit(1);

    if (previousBidsError) {
      console.error('前回入札取得エラー:', previousBidsError);
    }

    // 2. 前回の与信をキャンセル（別のユーザーの場合）
    if (previousBids && previousBids.length > 0 && previousBids[0].user_id !== userId) {
      const previousPaymentIntentId = previousBids[0].stripe_payment_intent_id;
      if (previousPaymentIntentId) {
        try {
          console.log('🔵 前回の与信をキャンセル:', previousPaymentIntentId);
          await stripe.paymentIntents.cancel(previousPaymentIntentId);
          console.log('✅ 前回の与信キャンセル成功');
        } catch (cancelError: any) {
          console.warn('⚠️ 与信キャンセルエラー（継続）:', cancelError.message);
          // エラーでも処理は継続（既にキャンセル済みの可能性）
        }
      }
    }

    // 3. 顧客のデフォルト支払い方法を取得
    const customer = await stripe.customers.retrieve(customerId);

    if (!customer || customer.deleted) {
      throw new Error('顧客が見つかりません');
    }

    const defaultPaymentMethodId = (customer as Stripe.Customer).invoice_settings?.default_payment_method;

    if (!defaultPaymentMethodId) {
      throw new Error('支払い方法が登録されていません');
    }

    // 3.5. PaymentMethodの詳細を取得してカード情報を確認
    const paymentMethod = await stripe.paymentMethods.retrieve(defaultPaymentMethodId as string);
    
    if (paymentMethod.type !== 'card') {
      throw new Error('カード以外の支払い方法は使用できません');
    }

    // カードの有効期限をチェック
    const card = paymentMethod.card;
    if (card) {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1; // 0-11 → 1-12
      const cardYear = card.exp_year || 0;
      const cardMonth = card.exp_month || 0;

      console.log('🔵 カード有効期限チェック:', {
        cardYear,
        cardMonth,
        currentYear,
        currentMonth,
      });

      // カードが期限切れかチェック
      if (cardYear < currentYear || (cardYear === currentYear && cardMonth < currentMonth)) {
        console.error('❌ カードが期限切れ:', { cardYear, cardMonth, currentYear, currentMonth });
        return res.status(400).json({
          error: '登録されているカードが期限切れです。カード情報を更新してください。',
          errorCode: 'card_expired',
          requiresAction: 'update_payment_method',
        });
      }
    }

    // 4. オークションからインフルエンサーIDを取得
    const { data: auction, error: auctionError } = await supabase
      .from('auctions')
      .select('call_slots!inner(user_id)')
      .eq('id', auctionId)
      .single();

    if (auctionError || !auction) {
      console.error('❌ オークション取得エラー:', auctionError);
      throw new Error('オークションが見つかりません');
    }

    const influencerUserId = (auction.call_slots as any)?.user_id;
    if (!influencerUserId) {
      throw new Error('インフルエンサーIDが取得できません');
    }

    // 5. インフルエンサー情報を取得（ConnectアカウントID、手数料率）
    const { data: influencer, error: influencerError } = await supabase
      .from('users')
      .select('stripe_connect_account_id, stripe_connect_account_status, platform_fee_rate')
      .eq('id', influencerUserId)
      .single();

    if (influencerError) {
      console.error('❌ インフルエンサー情報取得エラー:', influencerError);
      throw new Error('インフルエンサー情報が取得できません');
    }

    // 6. PaymentIntentを作成（Destination Charges方式 or Direct Charges方式）
    console.log('🔵 Payment Intent作成:', { 
      amount, 
      currency: 'jpy', 
      paymentMethodId: defaultPaymentMethodId,
      influencerUserId,
      hasConnectAccount: !!influencer?.stripe_connect_account_id,
      connectAccountStatus: influencer?.stripe_connect_account_status,
      platformFeeRate: influencer?.platform_fee_rate ?? 0.2,
    });

    let paymentIntent: Stripe.PaymentIntent;

    // Destination Charges方式（オンボーディング完了済みの場合）
    // 注意: card_payments capabilityがactiveである必要がある
    if (influencer?.stripe_connect_account_id && 
        influencer.stripe_connect_account_status === 'active') {
      
      // Connectアカウントのcapabilitiesを確認
      const stripeAccount = await stripe.accounts.retrieve(influencer.stripe_connect_account_id);
      const hasCardPayments = stripeAccount.capabilities?.card_payments === 'active';
      const hasTransfers = stripeAccount.capabilities?.transfers === 'active';
      
      console.log('🔵 Connectアカウントcapabilities確認:', {
        connectAccountId: influencer.stripe_connect_account_id,
        card_payments: stripeAccount.capabilities?.card_payments,
        transfers: stripeAccount.capabilities?.transfers,
        charges_enabled: stripeAccount.charges_enabled,
        payouts_enabled: stripeAccount.payouts_enabled,
      });

      // card_payments capabilityがactiveでない場合はDirect Charges方式にフォールバック
      if (!hasCardPayments || !hasTransfers || !stripeAccount.charges_enabled || !stripeAccount.payouts_enabled) {
        console.warn('⚠️ card_payments capabilityがactiveでないため、Direct Charges方式にフォールバック:', {
          hasCardPayments,
          hasTransfers,
          charges_enabled: stripeAccount.charges_enabled,
          payouts_enabled: stripeAccount.payouts_enabled,
        });
        
        // Direct Charges方式でPaymentIntentを作成
        paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount), // 円単位
          currency: 'jpy',
          customer: customerId,
          payment_method: defaultPaymentMethodId as string,
          capture_method: 'manual', // 手動キャプチャ（与信のみ）
          confirm: true, // 即座に確認
          off_session: true, // オフセッション決済
          metadata: {
            auction_id: auctionId,
            user_id: userId,
            influencer_id: influencerUserId,
            payment_method: 'direct_charges',
            fallback_reason: 'card_payments_capability_not_active',
          },
        });
      } else {
        // Destination Charges方式でPaymentIntentを作成
        const platformFeeRate = influencer.platform_fee_rate ?? 0.2; // デフォルト20%
        const platformFee = Math.round(amount * platformFeeRate);

        console.log('🔵 Destination Charges方式でPaymentIntentを作成:', {
          connectAccountId: influencer.stripe_connect_account_id,
          platformFeeRate,
          platformFee,
          influencerPayout: amount - platformFee,
        });

        paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount), // 円単位
          currency: 'jpy',
          customer: customerId,
          payment_method: defaultPaymentMethodId as string,
          capture_method: 'manual', // 手動キャプチャ（与信のみ）
          confirm: true, // 即座に確認
          off_session: true, // オフセッション決済
          // Destination Charges用の設定
          on_behalf_of: influencer.stripe_connect_account_id,
          application_fee_amount: platformFee,
          transfer_data: {
            destination: influencer.stripe_connect_account_id,
          },
          metadata: {
            auction_id: auctionId,
            user_id: userId,
            influencer_id: influencerUserId,
            platform_fee_rate: platformFeeRate.toString(),
            payment_method: 'destination_charges',
          },
        });
      }
    } else {
      // フォールバック: Direct Charges方式（オンボーディング未完了の場合）
      console.log('⚠️ オンボーディング未完了のため、Direct Charges方式でPaymentIntentを作成');
      
      paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount), // 円単位
        currency: 'jpy',
        customer: customerId,
        payment_method: defaultPaymentMethodId as string,
        capture_method: 'manual', // 手動キャプチャ（与信のみ）
        confirm: true, // 即座に確認
        off_session: true, // オフセッション決済
        metadata: {
          auction_id: auctionId,
          user_id: userId,
          influencer_id: influencerUserId,
          payment_method: 'direct_charges',
        },
      });
    }

    console.log('✅ Payment Intent作成成功:', {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
    });

    res.json({
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    });
  } catch (error: any) {
    console.error('❌ 与信確保エラー:', error);
    
    // Stripeのエラーコードに基づいて適切なエラーメッセージを返す
    if (error.type === 'StripeCardError') {
      const stripeError = error as Stripe.errors.StripeCardError;
      
      // カード期限切れエラー
      if (stripeError.code === 'expired_card' || stripeError.message?.includes('expired')) {
        return res.status(400).json({
          error: '登録されているカードが期限切れです。カード情報を更新してください。',
          errorCode: 'card_expired',
          requiresAction: 'update_payment_method',
        });
      }
      
      // その他のカードエラー
      if (stripeError.code === 'card_declined') {
        return res.status(400).json({
          error: 'カードが拒否されました。カード情報を確認するか、別のカードをお試しください。',
          errorCode: 'card_declined',
          requiresAction: 'update_payment_method',
        });
      }
      
      if (stripeError.code === 'insufficient_funds') {
        return res.status(400).json({
          error: 'カードの残高が不足しています。別のカードをお試しください。',
          errorCode: 'insufficient_funds',
          requiresAction: 'update_payment_method',
        });
      }
      
      // その他のカードエラー（汎用的なメッセージ）
      return res.status(400).json({
        error: `カードエラー: ${stripeError.message || 'カード情報を確認してください'}`,
        errorCode: stripeError.code || 'card_error',
        requiresAction: 'update_payment_method',
      });
    }
    
    // その他のStripeエラー
    if (error.type && error.type.startsWith('Stripe')) {
      return res.status(400).json({
        error: error.message || '決済処理でエラーが発生しました',
        errorCode: error.code || 'stripe_error',
      });
    }
    
    // 一般的なエラー
    res.status(500).json({ error: error.message || '与信確保に失敗しました' });
  }
});

// ============================================
// 即決購入
// ============================================
app.post('/api/buy-now', async (req: Request, res: Response) => {
  try {
    const { auctionId, userId, buyNowPrice, paymentIntentId } = req.body;

    console.log('🔵 即決購入処理開始:', { auctionId, userId, buyNowPrice });

    // 1. オークション情報を取得
    const { data: auction, error: auctionError } = await supabase
      .from('auctions')
      .select('id, call_slot_id, status, call_slots!inner(user_id, buy_now_price)')
      .eq('id', auctionId)
      .single();

    if (auctionError || !auction) {
      throw new Error('オークションが見つかりません');
    }

    if (auction.status !== 'active') {
      throw new Error('このオークションは終了しています');
    }

    // 即決価格が設定されているか確認
    const callSlot: any = auction.call_slots;
    if (!callSlot.buy_now_price) {
      throw new Error('このオークションには即決価格が設定されていません');
    }

    if (buyNowPrice !== callSlot.buy_now_price) {
      throw new Error('即決価格が一致しません');
    }

    const influencerUserId = callSlot.user_id;
    const platformFee = Math.round(buyNowPrice * 0.2);
    const influencerPayout = buyNowPrice - platformFee;

    // 2. 決済はTalk完了後に実行するため、ここではcaptureしない（与信保持）
    console.log('🔵 Payment Intent を保持（captureはTalk完了後に実行）:', paymentIntentId);

    // 3. オークション情報を更新（落札者と落札額）
    console.log('🔵 オークション情報を更新:', { userId, buyNowPrice });
    const { error: updateAuctionError } = await supabase
      .from('auctions')
      .update({
        current_winner_id: userId,
        current_highest_bid: buyNowPrice,
      })
      .eq('id', auctionId);

    if (updateAuctionError) {
      console.error('❌ オークション情報更新エラー:', updateAuctionError);
      throw updateAuctionError;
    }

    console.log('✅ オークション情報更新成功');

    // 3.5. call_slotsテーブルのfan_user_idを更新 (これをしないと購入済みTalkに表示されない)
    const { error: updateCallSlotError } = await supabase
      .from('call_slots')
      .update({ fan_user_id: userId })
      .eq('id', auction.call_slot_id)
      .is('deleted_at', null);

    if (updateCallSlotError) {
      console.error('❌ call_slots更新エラー:', updateCallSlotError);
      // エラーでも続行（購入自体は成立させるが、ログに残す）
    } else {
      console.log('✅ call_slots情報更新成功 (fan_user_id set)');
    }

    // 4. purchased_slotsテーブルに記録
    const { data: purchasedSlot, error: purchaseError } = await supabase
      .from('purchased_slots')
      .insert({
        call_slot_id: auction.call_slot_id,
        fan_user_id: userId,
        influencer_user_id: influencerUserId,
        auction_id: auctionId,
        stripe_payment_intent_id: paymentIntentId, // Talk完了後にcapture予定
        winning_bid_amount: buyNowPrice,
        platform_fee: platformFee,
        influencer_payout: influencerPayout,
        call_status: 'pending', // Talk完了待ち
      })
      .select()
      .single();

    if (purchaseError) {
      throw purchaseError;
    }

    console.log('✅ purchased_slots記録成功:', purchasedSlot.id);

    // call_slots.statusを'live'に更新
    const { error: statusUpdateError } = await supabase
      .from('call_slots')
      .update({ status: 'live' })
      .eq('id', auction.call_slot_id)
      .is('deleted_at', null);

    if (statusUpdateError) {
      console.error('❌ call_slots.status更新エラー:', statusUpdateError);
      // エラーでも続行（purchased_slotsの作成は成功している）
    } else {
      console.log('✅ call_slots.status更新成功 → live');
    }

    // 6. Edge Functionを呼び出してオークションを終了
    console.log('🔵 オークション終了Edge Functionを呼び出し');
    const edgeFunctionUrl = `${process.env.SUPABASE_URL}/functions/v1/finalize-buy-now-auction`;

    try {
      const finalizeResponse = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ auctionId, winnerId: userId }),
      });

      if (!finalizeResponse.ok) {
        const errorText = await finalizeResponse.text();
        console.warn('⚠️ オークション終了処理でエラー（継続）:', errorText);
      } else {
        console.log('✅ オークション終了処理完了');
      }
    } catch (finalizeError) {
      console.warn('⚠️ オークション終了処理失敗（継続）:', finalizeError);
    }

    console.log('✅ 即決購入完了（captureはTalk完了後に実行）');

    res.json({
      success: true,
      purchasedSlotId: purchasedSlot.id,
      paymentIntentId,
    });
  } catch (error: any) {
    console.error('❌ 即決購入エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 以前の与信をキャンセル
// ============================================
app.post('/api/stripe/cancel-authorization', async (req: Request, res: Response) => {
  try {
    const { paymentIntentId } = req.body;

    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);

    res.json({ success: true, status: paymentIntent.status });
  } catch (error: any) {
    console.error('与信キャンセルエラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 決済確定（落札時）
// ============================================
app.post('/api/stripe/capture-payment', async (req: Request, res: Response) => {
  try {
    const { paymentIntentId, auctionId } = req.body;

    // オークション終了処理（落札者確定のみ。決済はTalk完了後に実施）
    const { data: auctionResult, error: auctionError } = await supabase.rpc(
      'finalize_auction',
      { p_auction_id: auctionId }
    );

    if (auctionError) throw auctionError;

    if (!auctionResult || auctionResult.length === 0) {
      throw new Error('落札者がいません');
    }

    const { winner_fan_id, winning_amount } = auctionResult[0];

    // purchased_slotsを取得し、PaymentIntentIDを保存（captureは後続のTalk完了フローで実行）
    const { data: purchasedSlot, error: slotError } = await supabase
      .from('purchased_slots')
      .select('*')
      .eq('auction_id', auctionId)
      .single();

    if (slotError || !purchasedSlot) throw new Error('購入レコードが見つかりません');

    await supabase
      .from('purchased_slots')
      .update({
        stripe_payment_intent_id: paymentIntentId,
        call_status: 'pending',
      })
      .eq('id', purchasedSlot.id);

    // ここでは決済/送金/統計更新は行わない。Talk完了Webhookで処理。
    res.json({
      success: true,
      message: '落札確定（決済はTalk完了後に実施）',
      purchasedSlotId: purchasedSlot.id,
      paymentIntentId,
      amount: winning_amount,
      fanId: winner_fan_id,
    });
  } catch (error: any) {
    console.error('決済確定エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Stripe Connect Account作成（インフルエンサー用）
// ============================================
app.post('/api/stripe/create-connect-account', async (req: Request, res: Response) => {
  try {
    const { email, authUserId } = req.body;

    const account = await stripe.accounts.create({
      type: 'express',
      email,
      business_profile: {
        name: '推しトーク',
      },
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true }, // Destination Charges方式に必要
      },
      metadata: {
        auth_user_id: authUserId,
      },
    });

    // Supabaseを更新
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        stripe_account_id: account.id,
        stripe_connect_account_id: account.id,
        stripe_connect_account_status: 'pending'
      })
      .eq('auth_user_id', authUserId)
      .select();

    if (updateError) {
      console.error('❌ Supabase更新エラー:', updateError);
      throw updateError;
    }

    console.log('✅ Supabase更新成功:', updatedUser);

    // オンボーディングリンクを作成
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.FRONTEND_URL}/mypage`,
      return_url: `${process.env.FRONTEND_URL}/mypage`,
      type: 'account_onboarding',
    });

    res.json({
      accountId: account.id,
      onboardingUrl: accountLink.url,
    });
  } catch (error: any) {
    console.error('Connect Account作成エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// インフルエンサーの売上データ取得
// ============================================
app.post('/api/stripe/influencer-earnings', async (req: Request, res: Response) => {
  try {
    const { authUserId } = req.body;

    console.log('🔵 インフルエンサー売上データ取得:', { authUserId });

    // ユーザー情報を取得
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, stripe_connect_account_id')
      .eq('auth_user_id', authUserId)
      .single();

    if (userError || !user) {
      console.error('❌ ユーザー取得エラー:', userError);
      return res.status(404).json({ error: 'User not found' });
    }

    // payment_transactionsから売上データを取得（Stripe APIと照合）
    const { data: transactions, error: txError } = await supabase
      .from('payment_transactions')
      .select(`
        *,
        purchased_slots!inner (
          influencer_user_id,
          fan_user_id,
          call_slots (
            title
          )
        )
      `)
      .eq('purchased_slots.influencer_user_id', user.id)
      .eq('status', 'captured')
      .order('created_at', { ascending: false });

    if (txError) {
      console.error('❌ 取引データ取得エラー:', txError);
      throw txError;
    }

    // Stripeから直接売上データを取得（Balance Transactions APIを使用）
    let totalEarningsFromStripe = 0;
    let stripeEarningsError: string | null = null;

    if (user.stripe_connect_account_id) {
      try {
        console.log('🔵 Stripeから売上データ取得開始（Balance Transactions API使用）:', {
          connectAccountId: user.stripe_connect_account_id,
        });

        // Balance Transactions APIからすべての取引履歴を取得
        // Connect Account側のすべての取引（Transfer、Charge、Application Feeなど）を取得
        const balanceTransactions = await stripe.balanceTransactions.list({
          limit: 100,
        }, {
          stripeAccount: user.stripe_connect_account_id,
        });

        console.log('🔵 Balance Transactions取得:', {
          count: balanceTransactions.data.length,
          transactions: balanceTransactions.data.map(bt => ({
            id: bt.id,
            type: bt.type,
            amount: bt.amount,
            currency: bt.currency,
            status: bt.status,
            available_on: bt.available_on,
            created: bt.created,
            description: bt.description,
          })),
        });

        // 総売上: Connect Account側に入金されたすべての金額を集計
        // - Direct Charges方式: type='transfer'（プラットフォームからのTransfer）
        // - Destination Charges方式: type='payment'（直接Charge、自動分割済み）
        // 金額が正の値（入金）で、円単位のものを集計
        const allTransactions = balanceTransactions.data || [];
        const filteredTransactions = allTransactions.filter(bt => {
          // Transfer、Charge、Paymentで、成功しているもの
          // 注意: Destination Charges方式の場合、type='payment'が返される
          const isTransferChargeOrPayment = bt.type === 'transfer' || bt.type === 'charge' || bt.type === 'payment';
          // 金額が正の値（入金）
          const isPositive = bt.amount > 0;
          // 円単位
          const isJpy = bt.currency === 'jpy';
          // ステータスがavailableまたはpending（成功している）
          const isSuccessful = bt.status === 'available' || bt.status === 'pending';
          return isTransferChargeOrPayment && isPositive && isJpy && isSuccessful;
        });

        // JPY（日本円）はzero-decimal currencyのため、amountは既に円単位（100で割る必要なし）
        totalEarningsFromStripe = filteredTransactions.reduce((sum, bt) => sum + bt.amount, 0);

        // デバッグ用: フィルタリング前のすべての取引を詳細にログ出力
        console.log('🔍 デバッグ: すべてのBalance Transactions:', {
          totalCount: allTransactions.length,
          allTransactions: allTransactions.map(bt => ({
            id: bt.id,
            type: bt.type,
            amount: bt.amount,
            amountInYen: bt.amount, // JPYはzero-decimal currencyのため、既に円単位
            currency: bt.currency,
            status: bt.status,
            description: bt.description,
            available_on: bt.available_on,
            created: bt.created,
          })),
        });

        console.log('✅ Balance Transactionsから集計した総売上:', {
          allTransactionsCount: allTransactions.length,
          filteredTransactionsCount: filteredTransactions.length,
          totalEarnings: totalEarningsFromStripe,
          breakdown: {
            transfers: allTransactions.filter(bt => bt.type === 'transfer' && bt.amount > 0 && bt.currency === 'jpy').reduce((sum, bt) => sum + bt.amount, 0),
            charges: allTransactions.filter(bt => bt.type === 'charge' && bt.amount > 0 && bt.currency === 'jpy').reduce((sum, bt) => sum + bt.amount, 0),
            payments: allTransactions.filter(bt => bt.type === 'payment' && bt.amount > 0 && bt.currency === 'jpy').reduce((sum, bt) => sum + bt.amount, 0),
          },
          filterConditions: {
            type: 'transfer or charge or payment',
            amount: '> 0',
            currency: 'jpy',
            status: 'available or pending',
          },
          sampleTransactions: filteredTransactions.slice(0, 3).map(bt => ({
            id: bt.id,
            type: bt.type,
            amount: bt.amount, // JPYは既に円単位
            currency: bt.currency,
            status: bt.status,
          })),
        });

        // 入金予定額: Balance Transactionsからpendingステータスのものを集計
        // Stripeダッシュボードの「入金予定額」に合わせる
        pendingPayoutFromStripe = balanceTransactions.data
          .filter(bt => {
            // Transfer、Charge、Paymentで、保留中（pending）のもの
            // 注意: Destination Charges方式の場合、type='payment'が返される
            const isTransferChargeOrPayment = bt.type === 'transfer' || bt.type === 'charge' || bt.type === 'payment';
            // 金額が正の値（入金）
            const isPositive = bt.amount > 0;
            // 円単位
            const isJpy = bt.currency === 'jpy';
            // ステータスがpending（保留中）
            const isPending = bt.status === 'pending';
            return isTransferChargeOrPayment && isPositive && isJpy && isPending;
          })
          .reduce((sum, bt) => sum + bt.amount, 0); // JPYはzero-decimal currencyのため、amountは既に円単位

        console.log('✅ Balance Transactionsから集計した入金予定額:', pendingPayoutFromStripe);

        console.log('✅ Stripeから売上データ取得完了:', {
          totalEarnings: totalEarningsFromStripe,
          pendingPayout: pendingPayoutFromStripe,
        });

      } catch (error: any) {
        console.error('❌ Stripe売上データ取得エラー:', {
          message: error.message,
          type: error.type,
          code: error.code,
        });
        stripeEarningsError = error.message;
        // エラーでも続行（payment_transactionsから集計にフォールバック）
      }
    }

    // Stripeから残高情報を取得（入金予定額と出金可能額の計算に使用）
    let availableBalance = 0;
    let pendingBalance = 0;
    let balanceError: string | null = null;

    if (user.stripe_connect_account_id) {
      try {
        console.log('🔵 Stripe残高取得開始:', user.stripe_connect_account_id);

        const balance = await stripe.balance.retrieve({
          // stripeAccountは第2引数のオプションに含める必要がある
        }, {
          stripeAccount: user.stripe_connect_account_id,
        });

        console.log('✅ Stripe残高取得成功:', {
          available: balance.available,
          pending: balance.pending,
          connect_reserved: balance.connect_reserved,
        });

        // JPYはzero-decimal currencyのため、amountは既に円単位（100で割る必要なし）
        availableBalance = balance.available.reduce((sum, b) => sum + b.amount, 0);
        pendingBalance = balance.pending.reduce((sum, b) => sum + b.amount, 0);

        console.log('💰 計算後の残高:', { availableBalance, pendingBalance });
      } catch (error: any) {
        console.error('❌ 残高取得エラー:', {
          message: error.message,
          type: error.type,
          code: error.code,
          statusCode: error.statusCode,
        });
        balanceError = error.message;
      }
    } else {
      console.warn('⚠️ Connect Account ID が未設定');
    }

    // Stripe APIを優先: エラーの場合のみフォールバック
    let totalEarnings: number;
    let pendingPayout: number;
    let dataSource: 'stripe' | 'database' = 'stripe';
    let debugInfo: any = null;

    // フォールバック条件: エラーがある、またはConnect Account IDがない場合のみ
    const shouldUseFallback = stripeEarningsError || !user.stripe_connect_account_id;

    if (shouldUseFallback) {
      // フォールバック: payment_transactionsから集計
      console.log('⚠️ Stripeから取得できなかったため、payment_transactionsから集計', {
        stripeEarningsError,
        hasConnectAccountId: !!user.stripe_connect_account_id,
        transactionsCount: transactions?.length || 0,
      });
      
      dataSource = 'database';
      
      const totalEarningsFromDB = (transactions || []).filter(tx => 
        tx.stripe_transfer_id !== null && 
        tx.stripe_transfer_id !== undefined &&
        tx.stripe_transfer_id !== 'auto_split'
      ).reduce((sum, tx) => sum + (tx.influencer_payout || 0), 0);

      const autoSplitEarnings = (transactions || []).filter(tx => 
        tx.stripe_transfer_id === 'auto_split'
      ).reduce((sum, tx) => sum + (tx.influencer_payout || 0), 0);

      totalEarnings = totalEarningsFromDB + autoSplitEarnings;
      // フォールバック時は、Balance APIから取得したpendingBalanceを使用
      // （Balance APIが取得できない場合は0）
      pendingPayout = pendingBalance;

      debugInfo = {
        source: 'database',
        transactionsCount: transactions?.length || 0,
        breakdown: {
          transferEarnings: totalEarningsFromDB,
          autoSplitEarnings,
        },
      };

      console.log('✅ payment_transactionsから集計完了:', {
        totalEarnings,
        pendingPayout,
        breakdown: {
          transferEarnings: totalEarningsFromDB,
          autoSplitEarnings,
        },
      });
    } else {
      // Stripeから取得した値を使用（優先）
      totalEarnings = totalEarningsFromStripe;
      // 入金予定額はBalance APIから取得（Balance Transactions APIではなく）
      pendingPayout = pendingBalance;
      dataSource = 'stripe';
      
      debugInfo = {
        source: 'stripe',
        totalEarningsFromStripe,
        pendingPayoutFromStripe,
        connectAccountId: user.stripe_connect_account_id,
      };

      console.log('✅ Stripeから取得した値を使用（優先）:', { 
        totalEarnings, 
        pendingPayout,
        connectAccountId: user.stripe_connect_account_id,
      });
    }
    
    const totalCallCount = transactions?.length || 0;

    // 今月の売上を計算（Transfer済みのみ）
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const currentMonthTx = transactions?.filter(tx => {
      const txDate = new Date(tx.created_at);
      const isCurrentMonth = txDate >= currentMonthStart;
      const isTransferred = tx.stripe_transfer_id !== null && tx.stripe_transfer_id !== 'auto_split';
      const isAutoSplit = tx.stripe_transfer_id === 'auto_split';
      return isCurrentMonth && (isTransferred || isAutoSplit);
    }) || [];

    const previousMonthTx = transactions?.filter(tx => {
      const txDate = new Date(tx.created_at);
      const isPreviousMonth = txDate >= previousMonthStart && txDate < currentMonthStart;
      const isTransferred = tx.stripe_transfer_id !== null && tx.stripe_transfer_id !== 'auto_split';
      const isAutoSplit = tx.stripe_transfer_id === 'auto_split';
      return isPreviousMonth && (isTransferred || isAutoSplit);
    }) || [];

    const currentMonthEarnings = currentMonthTx.reduce((sum, tx) => sum + (tx.influencer_payout || 0), 0);
    const previousMonthEarnings = previousMonthTx.reduce((sum, tx) => sum + (tx.influencer_payout || 0), 0);

    // 直近5件の取引履歴を整形
    const recentTransactions = (transactions?.slice(0, 5) || []).map(tx => ({
      id: tx.id,
      talkTitle: tx.purchased_slots?.call_slots?.title || '通話',
      amount: tx.influencer_payout || 0,
      platformFee: tx.platform_fee || 0,
      grossAmount: tx.amount || 0,
      completedAt: tx.created_at,
      status: tx.status,
    }));

    res.json({
      totalEarnings,      // 総売上（Stripe API優先、エラー時はDBから）
      pendingPayout,      // 入金予定額（Stripe API優先、エラー時はDBから）
      availableBalance,   // Stripe残高（出金可能額）
      pendingBalance,     // Stripe保留中（参考情報）
      recentTransactions,
      monthlyStats: {
        currentMonth: {
          earnings: currentMonthEarnings,
          callCount: currentMonthTx.length,
          averagePrice: currentMonthTx.length > 0 ? currentMonthEarnings / currentMonthTx.length : 0,
        },
        previousMonth: {
          earnings: previousMonthEarnings,
          callCount: previousMonthTx.length,
        },
      },
      totalCallCount,
      balanceError, // 残高取得エラーがあれば含める
      stripeEarningsError, // Stripe売上データ取得エラーがあれば含める
      dataSource, // データソース: 'stripe' または 'database'
      debugInfo, // デバッグ情報（開発環境用）
    });

  } catch (error: any) {
    console.error('❌ 売上データ取得エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Stripe Express Dashboardリンク生成
// ============================================
app.post('/api/stripe/create-login-link', async (req: Request, res: Response) => {
  try {
    const { authUserId } = req.body;

    console.log('🔵 Express Dashboard Link生成:', { authUserId });

    // ユーザー情報を取得
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('stripe_connect_account_id')
      .eq('auth_user_id', authUserId)
      .single();

    if (userError || !user?.stripe_connect_account_id) {
      console.error('❌ Connect Account IDが見つかりません:', userError);
      return res.status(404).json({ error: 'Stripe Connect Account not found' });
    }

    const accountId = user.stripe_connect_account_id;

    // Stripeアカウントの状態を確認
    const stripeAccount = await stripe.accounts.retrieve(accountId);

    // 完了済みの場合はダッシュボードリンクを返す
    if (stripeAccount.charges_enabled && stripeAccount.payouts_enabled) {
      const loginLink = await stripe.accounts.createLoginLink(accountId);
      console.log('✅ Login Link生成成功:', loginLink.url);

      res.json({
        url: loginLink.url,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5分有効
      });
    } else {
      // 未完了の場合はオンボーディングリンクを返す
      console.log('🔵 アカウント未完了のためオンボーディングリンクを生成');
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${process.env.FRONTEND_URL}/mypage?stripe_refresh=true`,
        return_url: `${process.env.FRONTEND_URL}/mypage?stripe_complete=true`,
        type: 'account_onboarding',
      });

      res.json({
        url: accountLink.url,
        is_onboarding: true
      });
    }

  } catch (error: any) {
    console.error('❌ Login Link生成エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// オンボーディング作成/再開（途中離脱対応）
// ============================================
app.post('/api/stripe/create-or-resume-onboarding', async (req: Request, res: Response) => {
  try {
    const { authUserId, email } = req.body;

    console.log('🔵 オンボーディング作成/再開:', { authUserId, email });

    // 既存のアカウントIDを確認
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('stripe_connect_account_id, stripe_connect_account_status')
      .eq('auth_user_id', authUserId)
      .single();

    if (userError) {
      console.error('❌ ユーザー取得エラー:', userError);
      return res.status(404).json({ error: 'User not found' });
    }

    let accountId = user?.stripe_connect_account_id;

    // アカウントが存在しない場合は新規作成
    if (!accountId) {
      console.log('🔵 新規Connect Account作成');
      const account = await stripe.accounts.create({
        type: 'express',
        email,
        business_profile: {
          name: '推しトーク',
        },
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true }, // Destination Charges方式に必要
        },
        metadata: {
          auth_user_id: authUserId,
        },
      });
      accountId = account.id;

      // DBを更新
      await supabase
        .from('users')
        .update({
          stripe_connect_account_id: accountId,
          stripe_connect_account_status: 'pending',
        })
        .eq('auth_user_id', authUserId);

      console.log('✅ Connect Account作成成功:', accountId);
    }

    // 既存アカウントの状態を確認
    const stripeAccount = await stripe.accounts.retrieve(accountId);

    // card_payments capabilityがリクエストされていない場合はリクエスト
    if (stripeAccount.capabilities?.card_payments !== 'active' && 
        stripeAccount.capabilities?.card_payments !== 'pending') {
      console.log('🔵 card_payments capabilityをリクエスト中...');
      try {
        await stripe.accounts.update(accountId, {
          capabilities: {
            card_payments: { requested: true },
          },
        });
        console.log('✅ card_payments capabilityのリクエストが成功しました');
      } catch (capabilityError: any) {
        console.warn('⚠️ card_payments capabilityのリクエストに失敗しました:', capabilityError.message);
        // エラーでも続行（オンボーディングリンクを返す）
      }
    }

    // 完了済みの場合はダッシュボードリンクを返す
    if (stripeAccount.charges_enabled && stripeAccount.payouts_enabled) {
      console.log('✅ アカウント設定完了済み - Dashboard Link生成');
      const loginLink = await stripe.accounts.createLoginLink(accountId);

      return res.json({
        status: 'complete',
        dashboardUrl: loginLink.url,
      });
    }

    // 未完了の場合はオンボーディングリンクを返す
    console.log('🔵 オンボーディングリンク生成（未完了/再開）');
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.FRONTEND_URL}/mypage?stripe_refresh=true`,
      return_url: `${process.env.FRONTEND_URL}/mypage?stripe_complete=true`,
      type: 'account_onboarding',
    });

    res.json({
      status: stripeAccount.details_submitted ? 'pending' : 'incomplete',
      onboardingUrl: accountLink.url,
    });

  } catch (error: any) {
    console.error('❌ オンボーディング作成/再開エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// インフルエンサーのStripe状態確認
// ============================================
app.post('/api/stripe/influencer-status', async (req: Request, res: Response) => {
  try {
    const { authUserId } = req.body;

    console.log('🔵 インフルエンサー状態確認開始:', { authUserId });

    // UUIDの形式チェック
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(authUserId)) {
      console.error('❌ 無効なUUID形式:', authUserId);
      return res.status(400).json({
        error: 'Invalid UUID format',
        received: authUserId
      });
    }

    // ユーザー情報を取得
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('stripe_connect_account_id, stripe_connect_account_status')
      .eq('auth_user_id', authUserId)
      .single();

    if (userError) {
      console.error('❌ ユーザー取得エラー:', userError);
      return res.status(404).json({
        error: 'User not found',
        details: userError.message
      });
    }

    if (!user?.stripe_connect_account_id) {
      console.log('⚠️  Stripe Connect Account ID が設定されていません');
      return res.json({
        accountStatus: 'not_setup',
        accountId: null,
        isVerified: false
      });
    }

    // Stripeアカウントの状態を確認
    const stripeAccount = await stripe.accounts.retrieve(user.stripe_connect_account_id);

    console.log('✅ Stripe Account状態:', {
      id: stripeAccount.id,
      charges_enabled: stripeAccount.charges_enabled,
      payouts_enabled: stripeAccount.payouts_enabled,
      details_submitted: stripeAccount.details_submitted,
      capabilities: stripeAccount.capabilities, // capabilitiesを確認
    });

    let accountStatus = 'pending';
    if (stripeAccount.charges_enabled && stripeAccount.payouts_enabled) {
      accountStatus = 'active';
    } else if (stripeAccount.details_submitted) {
      accountStatus = 'pending';
    } else {
      accountStatus = 'incomplete';
    }

    // データベースの状態を実際のStripe状態に同期
    if (user.stripe_connect_account_status !== accountStatus) {
      console.log('🔄 Stripe状態を同期中:', {
        db_status: user.stripe_connect_account_status,
        stripe_status: accountStatus
      });

      const { error: syncError } = await supabase
        .from('users')
        .update({
          stripe_connect_account_status: accountStatus,
          is_verified: accountStatus === 'active'
        })
        .eq('auth_user_id', authUserId);

      if (syncError) {
        console.error('❌ 状態同期エラー:', syncError);
      } else {
        console.log('✅ 状態同期完了:', accountStatus);
      }
    }

    res.json({
      accountStatus,
      accountId: stripeAccount.id,
      isVerified: stripeAccount.charges_enabled && stripeAccount.payouts_enabled,
      chargesEnabled: stripeAccount.charges_enabled,
      payoutsEnabled: stripeAccount.payouts_enabled,
      detailsSubmitted: stripeAccount.details_submitted,
      capabilities: stripeAccount.capabilities, // capabilitiesを返す
      canUseDestinationCharges: 
        stripeAccount.capabilities?.card_payments === 'active' &&
        stripeAccount.capabilities?.transfers === 'active' &&
        stripeAccount.charges_enabled === true &&
        stripeAccount.payouts_enabled === true,
    });

  } catch (error: any) {
    console.error('インフルエンサー状態確認エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Webhook受信（Stripeイベント処理）
// ============================================
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    switch (event.type) {
      case 'payment_intent.succeeded':
        // 決済成功時の処理
        // 注意: Transfer処理はCapture時に実行済みのため、Webhookではスキップ
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('🔵 PaymentIntent成功（Webhook受信）:', paymentIntent.id);
        
        // payment_transactionsの状態を確認（ログ用）
        const { data: paymentTx } = await supabase
          .from('payment_transactions')
          .select('stripe_transfer_id')
          .eq('stripe_payment_intent_id', paymentIntent.id)
          .maybeSingle();

        if (paymentTx) {
          if (paymentTx.stripe_transfer_id === 'auto_split') {
            console.log('✅ Destination Charges方式: 自動分割済み（Transfer処理不要）');
          } else if (paymentTx.stripe_transfer_id) {
            console.log('✅ Transfer処理は既に完了済み:', paymentTx.stripe_transfer_id);
          } else {
            console.log('ℹ️ Transfer処理はCapture時に実行済み（または実行中）');
          }
        } else {
          console.log('ℹ️ payment_transactionsが見つかりません（Capture処理前の可能性）');
        }
        break;

      case 'payment_intent.payment_failed':
        // 決済失敗時の処理
        console.log('PaymentIntent失敗:', event.data.object.id);
        await supabase
          .from('payment_transactions')
          .update({
            status: 'failed',
            error_message: (event.data.object as any).last_payment_error?.message,
          })
          .eq('stripe_payment_intent_id', event.data.object.id);
        break;

      case 'account.updated':
        // Connectアカウント更新時
        const account = event.data.object as Stripe.Account;
        console.log('🔵 Stripe Connect Account更新:', {
          id: account.id,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          details_submitted: account.details_submitted
        });

        // アカウント情報を更新
        const updateData: any = {
          stripe_connect_account_id: account.id,
          stripe_connect_account_status: account.charges_enabled && account.payouts_enabled ? 'active' : 'pending'
        };

        if (account.charges_enabled && account.payouts_enabled) {
          updateData.is_verified = true;
        }

        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update(updateData)
          .eq('stripe_account_id', account.id)
          .select();

        if (updateError) {
          console.error('❌ Stripe Connect Account更新エラー:', updateError);
        } else {
          console.log('✅ Stripe Connect Account更新成功:', updatedUser);
        }
        break;
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook処理エラー:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

// ============================================
// Talk枠とオークション情報を一括更新（トランザクション管理）
// ============================================
app.put('/api/call-slots/:callSlotId', async (req: Request, res: Response) => {
  try {
    const { callSlotId } = req.params;
    const {
      authUserId,
      title,
      description,
      scheduled_start_time,
      duration_minutes,
      starting_price,
      minimum_bid_increment,
      buy_now_price,
      thumbnail_url,
      auction_end_time
    } = req.body;

    console.log('🔵 Talk枠更新開始:', {
      callSlotId,
      authUserId,
      callSlotIdType: typeof callSlotId,
      callSlotIdLength: callSlotId?.length
    });

    if (!authUserId) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    if (!callSlotId) {
      return res.status(400).json({ error: 'Talk枠IDが指定されていません' });
    }

    // 1. ユーザー情報を取得
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', authUserId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }

    // 2. Talk枠情報を取得（権限確認のため）
    console.log('🔍 Talk枠取得開始:', { callSlotId });
    const { data: callSlot, error: callSlotError } = await supabase
      .from('call_slots')
      .select('id, user_id')
      .eq('id', callSlotId)
      .is('deleted_at', null)
      .single();

    if (callSlotError) {
      console.error('❌ Talk枠取得エラー:', {
        error: callSlotError,
        code: callSlotError.code,
        message: callSlotError.message,
        details: callSlotError.details,
        hint: callSlotError.hint,
        callSlotId
      });
      return res.status(404).json({
        error: 'Talk枠が見つかりません',
        details: callSlotError.message
      });
    }

    if (!callSlot) {
      console.error('❌ Talk枠が見つかりません:', { callSlotId });
      return res.status(404).json({ error: 'Talk枠が見つかりません' });
    }

    // 3. オークション情報を取得（auction_idを取得するため）
    const { data: auction, error: auctionError } = await supabase
      .from('auctions')
      .select('id')
      .eq('call_slot_id', callSlotId)
      .single();

    const auctionId = auction?.id || null;

    console.log('✅ Talk枠取得成功:', {
      id: callSlot.id,
      user_id: callSlot.user_id,
      auction_id: auctionId
    });

    // 4. 権限確認（インフルエンサーが自分のTalk枠を更新できるか）
    if (callSlot.user_id !== user.id) {
      return res.status(403).json({ error: 'このTalk枠を更新する権限がありません' });
    }

    // 5. end_timeを計算（scheduled_start_time + duration_minutes）
    let endTimeUTC: string | undefined;
    if (scheduled_start_time && duration_minutes) {
      const scheduledTime = new Date(scheduled_start_time);
      const endTime = new Date(scheduledTime.getTime() + duration_minutes * 60 * 1000);
      endTimeUTC = endTime.toISOString();
    }

    // 6. call_slotsテーブルを更新
    const callSlotUpdateData: any = {};
    if (title !== undefined) callSlotUpdateData.title = title;
    if (description !== undefined) callSlotUpdateData.description = description;
    if (scheduled_start_time !== undefined) callSlotUpdateData.scheduled_start_time = scheduled_start_time;
    if (duration_minutes !== undefined) callSlotUpdateData.duration_minutes = duration_minutes;
    if (starting_price !== undefined) callSlotUpdateData.starting_price = starting_price;
    if (minimum_bid_increment !== undefined) callSlotUpdateData.minimum_bid_increment = minimum_bid_increment;
    if (buy_now_price !== undefined) callSlotUpdateData.buy_now_price = buy_now_price;
    if (thumbnail_url !== undefined) callSlotUpdateData.thumbnail_url = thumbnail_url;
    if (endTimeUTC) callSlotUpdateData.end_time = endTimeUTC;
    callSlotUpdateData.updated_at = new Date().toISOString();

    const { data: updatedCallSlot, error: callSlotUpdateError } = await supabase
      .from('call_slots')
      .update(callSlotUpdateData)
      .eq('id', callSlotId)
      .is('deleted_at', null)
      .select()
      .single();

    if (callSlotUpdateError) {
      console.error('❌ Talk枠更新エラー:', callSlotUpdateError);
      throw callSlotUpdateError;
    }

    console.log('✅ Talk枠更新成功:', updatedCallSlot.id);

    // 7. オークション情報を更新（auction_idが存在する場合）
    if (auctionId) {
      const auctionUpdateData: any = {
        updated_at: new Date().toISOString()
      };

      // auction_end_timeが指定されている場合は更新
      if (auction_end_time !== undefined && auction_end_time !== null && auction_end_time !== '') {
        auctionUpdateData.auction_end_time = auction_end_time;
        auctionUpdateData.end_time = auction_end_time;
        console.log('🔵 オークション終了時間を更新:', auction_end_time);
      }

      // オークション情報を更新（auction_end_timeが指定されていない場合でもupdated_atは更新）
      if (Object.keys(auctionUpdateData).length > 1 || auction_end_time !== undefined) {
        const { data: updatedAuction, error: auctionUpdateError } = await supabase
          .from('auctions')
          .update(auctionUpdateData)
          .eq('id', auctionId)
          .select()
          .single();

        if (auctionUpdateError) {
          console.error('❌ オークション更新エラー:', auctionUpdateError);
          // Talk枠の更新は成功しているが、オークションの更新に失敗
          // ロールバックは難しいので、エラーを返す
          throw new Error(`Talk枠は更新されましたが、オークション情報の更新に失敗しました: ${auctionUpdateError.message}`);
        }

        if (updatedAuction) {
          console.log('✅ オークション更新成功:', updatedAuction.id);
        }
      } else {
        console.log('⚠️ オークション終了時間が指定されていないため、オークション情報は更新しません');
      }
    } else {
      console.log('⚠️ オークションIDが見つかりません（オークション未作成の可能性）');
    }

    res.json({
      success: true,
      callSlot: updatedCallSlot,
      message: 'Talk枠を更新しました'
    });
  } catch (error: any) {
    console.error('❌ Talk枠更新エラー:', error);
    res.status(500).json({ error: error.message || 'Talk枠の更新に失敗しました' });
  }
});

// ============================================
// オークション終了処理（手動実行または定期実行）
// ============================================
app.post('/api/auctions/finalize-ended', async (req: Request, res: Response) => {
  try {
    console.log('🔵 オークション終了処理開始');

    // 1. 終了したオークションを取得
    const now = new Date().toISOString();
    const { data: endedAuctions, error: auctionsError } = await supabase
      .from('active_auctions_view')
      .select('auction_id, call_slot_id, influencer_id, end_time, current_highest_bid')
      .eq('status', 'active')
      .lte('end_time', now);

    if (auctionsError) {
      throw auctionsError;
    }

    if (!endedAuctions || endedAuctions.length === 0) {
      console.log('✅ 終了したオークションはありません');
      return res.json({ message: '終了したオークションはありません', processed: 0 });
    }

    console.log(`🔵 ${endedAuctions.length}件のオークションを処理します`);

    const results = [];

    for (const auction of endedAuctions) {
      try {
        console.log(`🔵 オークション処理: ${auction.auction_id}`);

        // 2. 最高入札を取得
        const { data: highestBid, error: bidError } = await supabase
          .from('bids')
          .select('*')
          .eq('auction_id', auction.auction_id)
          .order('bid_amount', { ascending: false })
          .limit(1)
          .single();

        if (bidError || !highestBid) {
          console.log(`⚠️ 入札なし: ${auction.auction_id}`);
          // オークションを終了状態に更新
          await supabase
            .from('auctions')
            .update({ status: 'ended' })
            .eq('id', auction.auction_id);

          results.push({ auction_id: auction.auction_id, status: 'no_bids' });
          continue;
        }

        console.log(`🔵 最高入札: ¥${highestBid.bid_amount} by ${highestBid.user_id}`);

        // 3. プラットフォーム手数料計算（20%）
        const platformFee = Math.round(highestBid.bid_amount * 0.2);
        const influencerPayout = highestBid.bid_amount - platformFee;

        // 4. purchased_slotsテーブルに記録（決済は保留）
        const { data: purchasedSlot, error: purchaseError } = await supabase
          .from('purchased_slots')
          .insert({
            call_slot_id: auction.call_slot_id,
            fan_user_id: highestBid.user_id,
            influencer_user_id: auction.influencer_id,
            auction_id: auction.auction_id,
            winning_bid_amount: highestBid.bid_amount,
            platform_fee: platformFee,
            influencer_payout: influencerPayout,
            call_status: 'pending', // Talk完了後に決済
          })
          .select()
          .single();

        if (purchaseError) {
          throw purchaseError;
        }

        console.log(`✅ purchased_slots記録成功: ${purchasedSlot.id}（決済は保留）`);

        // call_slots.statusを'live'に更新、fan_user_idも更新（ファンのTalkPageに表示されるように）
        const { error: statusUpdateError } = await supabase
          .from('call_slots')
          .update({ 
            status: 'live',
            fan_user_id: highestBid.user_id  // ファンのTalkPageに表示されるように更新
          })
          .eq('id', auction.call_slot_id);

        if (statusUpdateError) {
          console.error('❌ call_slots更新エラー:', statusUpdateError);
          // エラーでも続行（purchased_slotsの作成は成功している）
        } else {
          console.log(`✅ call_slots更新成功: ${auction.call_slot_id} → status: 'live', fan_user_id: ${highestBid.user_id}`);
        }

        // 5. オークションを終了状態に更新
        await supabase
          .from('auctions')
          .update({ status: 'ended', winner_user_id: highestBid.user_id })
          .eq('id', auction.auction_id);

        // 6. 他の入札者の与信をキャンセル
        const { data: otherBids } = await supabase
          .from('bids')
          .select('stripe_payment_intent_id, user_id')
          .eq('auction_id', auction.auction_id)
          .neq('user_id', highestBid.user_id);

        if (otherBids && otherBids.length > 0) {
          console.log(`🔵 他の入札者の与信をキャンセル: ${otherBids.length}件`);
          for (const bid of otherBids) {
            if (bid.stripe_payment_intent_id) {
              try {
                await stripe.paymentIntents.cancel(bid.stripe_payment_intent_id);
                console.log(`✅ 与信キャンセル: ${bid.stripe_payment_intent_id}`);
              } catch (cancelError: any) {
                console.warn(`⚠️ 与信キャンセル失敗（継続）: ${cancelError.message}`);
              }
            }
          }
        }

        // 7. ユーザー統計を更新
        await supabase.rpc('update_user_statistics', {
          p_fan_id: highestBid.user_id,
          p_influencer_id: auction.influencer_id,
          p_amount: highestBid.bid_amount,
        });

        results.push({
          auction_id: auction.auction_id,
          status: 'success',
          winner_id: highestBid.user_id,
          amount: highestBid.bid_amount,
          purchased_slot_id: purchasedSlot.id,
        });

        console.log(`✅ オークション終了処理完了: ${auction.auction_id} (決済はTalk完了後)`);

      } catch (error: any) {
        console.error(`❌ オークション処理エラー: ${error.message}`);
        results.push({
          auction_id: auction.auction_id,
          status: 'error',
          error: error.message,
        });
      }
    }

    console.log('✅ 全オークション処理完了');

    res.json({
      processed: endedAuctions.length,
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('❌ エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ヘルスチェック
// ============================================
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// SPAルーティング（本番環境のみ）
// APIルート以外のすべてのリクエストをindex.htmlにルーティング
// ============================================
if (process.env.NODE_ENV === 'production') {
  // APIルート以外をキャッチ
  app.use((req: Request, res: Response, next: any) => {
    if (req.path.startsWith('/api/') || req.path === '/health') {
      next();
    } else {
      res.sendFile(path.join(__dirname, '../../dist/index.html'));
    }
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📂 Environment: ${process.env.NODE_ENV || 'development'}`);
  if (process.env.NODE_ENV === 'production') {
    console.log(`📦 Serving static files from dist/`);
  }

  // ============================================
  // オークション自動終了スケジューラー
  // ============================================
  console.log('⏰ スケジューラーを初期化中...');

  // 1分ごとに実行
  cron.schedule('* * * * *', async () => {
    console.log('⏰ 自動終了処理を実行開始...');
    const edgeFunctionUrl = `${process.env.SUPABASE_URL}/functions/v1/finalize-auctions`;

    try {
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ 自動終了処理エラー:', errorText);
      } else {
        const result: any = await response.json();
        if (result.processed > 0) {
          console.log(`✅ 自動終了処理完了: ${result.processed}件のオークションを処理しました`);
          console.log('詳細:', JSON.stringify(result.results, null, 2));
        } else {
          // 処理なしの場合はログを抑制（ノイズ削減）
          // console.log('✅ 終了対象のオークションはありませんでした');
        }
      }
    } catch (error: any) {
      console.error('❌ 自動終了処理呼び出し失敗:', error.message);
    }
  });

  console.log('✅ スケジューラー起動完了: 毎分オークション終了判定を行います');
});


