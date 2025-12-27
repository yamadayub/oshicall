import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, History, Edit3, Share2, Info } from 'lucide-react';
import { mockTalkSessions, mockBids } from '../data/mockData';
import { TalkSession } from '../types';
import CountdownTimer from '../components/CountdownTimer';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import AuthModal from '../components/AuthModal';
import CardRegistrationModal from '../components/CardRegistrationModal';

export default function TalkDetail() {
  const { talkId } = useParams<{ talkId: string }>();
  const navigate = useNavigate();
  const { user, supabaseUser, refreshUser } = useAuth();
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isMyBid, setIsMyBid] = useState<boolean>(false);
  const [talk, setTalk] = useState<TalkSession | null>(null);
  const [auctionId, setAuctionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [currentHighestBid, setCurrentHighestBid] = useState<number>(0);

  // オークション終了後の状態管理
  const [auctionStatus, setAuctionStatus] = useState<'active' | 'ended'>('active');
  const [isWinner, setIsWinner] = useState<boolean>(false);
  const [userHasBid, setUserHasBid] = useState<boolean>(false);

  // モーダル管理
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [pendingBidAmount, setPendingBidAmount] = useState<number>(0);

  // Talk詳細の初期取得
  useEffect(() => {
    const fetchTalkDetail = async () => {
      try {
        setIsLoading(true);

        console.log('🔍 Talk詳細を取得中...', { talkId });

        // auctionsとcall_slotsから直接取得（activeとended両方を取得）
        const { data: auctionData, error } = await supabase
          .from('auctions')
          .select(`
            id,
            call_slot_id,
            status,
            start_time,
            end_time,
            current_highest_bid,
            current_winner_id,
            call_slots!inner(
              id,
              user_id,
              title,
              description,
              scheduled_start_time,
              duration_minutes,
              starting_price,
              minimum_bid_increment,
              buy_now_price,
              thumbnail_url,
              users!call_slots_user_id_fkey(
                id,
                display_name,
                bio,
                profile_image_url,
                total_calls_completed,
                average_rating
              )
            )
          `)
          .eq('call_slot_id', talkId)
          .single();

        if (error) {
          console.error('❌ Talk詳細取得エラー:', error);
          console.error('エラーメッセージ:', error.message);
          console.error('エラーコード:', error.code);
          console.error('エラー詳細:', JSON.stringify(error, null, 2));
          console.error('talkId:', talkId);
          // フォールバック: モックデータから取得
          const mockTalk = mockTalkSessions.find(t => t.id === talkId);
          if (mockTalk) {
            setTalk(mockTalk);
            setCurrentHighestBid(mockTalk.current_highest_bid);
          }
          return;
        }

        console.log('📦 取得したデータ:', { auctionData });
        console.log('📦 auctionData型:', typeof auctionData);
        console.log('📦 call_slots型:', typeof auctionData?.call_slots);

        // call_slotsとusersは多対一のリレーションなので、オブジェクトとして返される
        const callSlot = auctionData?.call_slots;
        const user = callSlot?.users;

        console.log('📊 展開したデータ:', { callSlot, user });

        if (!auctionData || !callSlot) {
          console.error('❌ データが取得できませんでした:', {
            talkId,
            auctionData,
            callSlot,
            user,
          });
          return;
        }

        const data = {
          auction_id: auctionData.id,
          call_slot_id: auctionData.call_slot_id,
          status: auctionData.status,
          end_time: auctionData.end_time,
          current_highest_bid: auctionData.current_highest_bid,
          current_winner_id: auctionData.current_winner_id,
          ...callSlot,
          influencer_id: callSlot.user_id,
          influencer_name: user?.display_name,
          influencer_bio: user?.bio,
          influencer_image: user?.profile_image_url,
          total_calls_completed: user?.total_calls_completed,
          average_rating: user?.average_rating,
        };

        if (data) {
          // 実際のauction_idを保存
          setAuctionId(data.auction_id);

          console.log('📊 取得したTalk時刻データ:', {
            scheduled_start_time: (data as any).scheduled_start_time,
            duration_minutes: (data as any).duration_minutes,
          });

          // ビューデータをTalkSession形式に変換
          const talkSession: TalkSession = {
            id: data.call_slot_id,
            influencer_id: data.influencer_id,
            influencer: {
              id: data.influencer_id,
              name: data.influencer_name,
              username: data.influencer_name, // display_nameを使用
              avatar_url: data.influencer_image || '/images/talks/default.jpg',
              description: data.influencer_bio || '',
              follower_count: 0,
              total_earned: 0,
              total_talks: data.total_calls_completed || 0,
              rating: data.average_rating || 0,
              created_at: new Date().toISOString(),
            },
            title: data.title || `${data.influencer_name}とのTalk`,
            description: data.description || '',
            host_message: data.influencer_bio || data.description || `${data.influencer_name}とお話ししましょう！`,
            start_time: data.scheduled_start_time,
            end_time: new Date(new Date(data.scheduled_start_time).getTime() + data.duration_minutes * 60000).toISOString(),
            auction_end_time: data.end_time,
            starting_price: data.starting_price,
            current_highest_bid: data.current_highest_bid || data.starting_price,
            buy_now_price: data.buy_now_price || null,
            status: data.status === 'active' ? 'upcoming' : 'ended',
            created_at: new Date().toISOString(),
            detail_image_url: data.thumbnail_url || data.influencer_image || '/images/talks/default.jpg',
            is_female_only: false,
          };

          console.log('📊 変換後のTalk時刻:', {
            start_time: talkSession.start_time,
            end_time: talkSession.end_time,
          });

          setTalk(talkSession);
          setCurrentHighestBid(talkSession.current_highest_bid);

          // オークションステータスを設定
          console.log('🎯 オークションステータス:', data.status);
          setAuctionStatus(data.status as 'active' | 'ended');
          console.log('🎯 auctionStatusをセット:', data.status);

          // オークション終了後の状態を設定
          if (data.status === 'ended') {
            console.log('🏁 オークション終了を検知');

            if (!supabaseUser) {
              console.log('⚠️ ログインしていないユーザー');
              // ログインしていないユーザーの場合も終了画面を表示
            } else {
              // purchased_slotsを取得して、purchased_slot_idを確認
              const { data: purchasedSlot, error: purchasedError } = await supabase
                .from('purchased_slots')
                .select('id, fan_user_id, influencer_user_id')
                .eq('call_slot_id', talkId)
                .maybeSingle();

              if (!purchasedError && purchasedSlot) {
                // purchased_slotが存在する場合
                const isFan = purchasedSlot.fan_user_id === supabaseUser.id;
                const isInfluencer = purchasedSlot.influencer_user_id === supabaseUser.id;

                if (isFan || isInfluencer) {
                  // 落札者またはインフルエンサーの場合、直接Talk画面にリダイレクト
                  console.log('✅ purchased_slotが見つかりました。Talk画面にリダイレクト:', purchasedSlot.id);
                  setIsLoading(false); // ローディングを解除
                  navigate(`/call/${purchasedSlot.id}`);
                  return; // 早期リターンでオークション完了モーダルを表示しない
                }
              }

              // purchased_slotが存在しない、または関係者でない場合のみ、オークション完了モーダルを表示
              // 落札者かどうかを判定（current_winner_idを使用）
              const userIsWinner = data.current_winner_id === supabaseUser.id;
              setIsWinner(userIsWinner);

              // ユーザーが入札したかどうかを確認
              const { data: userBids, error: bidsError } = await supabase
                .from('bids')
                .select('id')
                .eq('auction_id', data.auction_id)
                .eq('user_id', supabaseUser.id)
                .limit(1);

              if (!bidsError && userBids && userBids.length > 0) {
                setUserHasBid(true);
              }

              console.log('🏁 オークション終了状態:', {
                isWinner: userIsWinner,
                hasBid: userBids && userBids.length > 0,
              });
            }
          }

          // 現在のユーザーが最高入札者かチェック（アクティブな場合のみ）
          if (supabaseUser && data.current_highest_bid && data.status === 'active') {
            checkIfUserIsHighestBidder(data.auction_id);
          }
        }
      } catch (err) {
        console.error('データ取得エラー:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (talkId) {
      fetchTalkDetail();
    }
  }, [talkId, supabaseUser]);

  // ユーザーが最高入札者かチェック
  const checkIfUserIsHighestBidder = async (auctionIdToCheck: string) => {
    if (!supabaseUser) return;

    try {
      // 最高入札を取得
      const { data: highestBid, error } = await supabase
        .from('bids')
        .select('user_id')
        .eq('auction_id', auctionIdToCheck)
        .order('bid_amount', { ascending: false })
        .limit(1)
        .single();

      if (!error && highestBid) {
        setIsMyBid(highestBid.user_id === supabaseUser.id);
      }
    } catch (err) {
      console.error('最高入札者チェックエラー:', err);
    }
  };

  // ポーリング方式で入札情報を定期的に更新（3秒ごと）
  useEffect(() => {
    if (!auctionId) {
      console.log('⚠️ auctionIdが未設定のため、ポーリングを開始できません');
      return;
    }

    console.log('🔵 ポーリング開始: オークション情報を3秒ごとに更新します', auctionId);

    let hasDetectedEnd = false; // オークション終了を一度だけ検知するためのフラグ

    const fetchAuctionUpdate = async () => {
      try {
        // オークション情報を取得
        const { data: updatedAuction, error } = await supabase
          .from('auctions')
          .select('current_highest_bid, current_winner_id, status')
          .eq('id', auctionId)
          .single();

        if (!error && updatedAuction) {
          // オークション終了を検知（一度だけ状態を更新）
          if (updatedAuction.status === 'ended' && !hasDetectedEnd) {
            console.log('🎉 オークション終了を検知');
            hasDetectedEnd = true;

            // オークション終了状態を設定
            setAuctionStatus('ended');

            // 落札者かどうかを判定（current_winner_idを使用）
            if (supabaseUser) {
              const userIsWinner = updatedAuction.current_winner_id === supabaseUser.id;
              setIsWinner(userIsWinner);

              // ユーザーが入札したかどうかを確認
              const { data: userBids, error: bidsError } = await supabase
                .from('bids')
                .select('id')
                .eq('auction_id', auctionId)
                .eq('user_id', supabaseUser.id)
                .limit(1);

              if (!bidsError && userBids && userBids.length > 0) {
                setUserHasBid(true);
              }

              console.log('🏁 オークション終了（ポーリング検知）:', {
                isWinner: userIsWinner,
                hasBid: userBids && userBids.length > 0,
              });
            }
            return; // ポーリングを停止
          }

          // 最高入札額を更新（依存配列の問題を避けるため常に更新）
          setCurrentHighestBid(prevBid => {
            if (updatedAuction.current_highest_bid !== prevBid) {
              console.log('🔔 新しい入札を検知:', {
                old: prevBid,
                new: updatedAuction.current_highest_bid,
                winner_id: updatedAuction.current_winner_id
              });
            }
            return updatedAuction.current_highest_bid;
          });

          // 自分が最高入札者かチェック
          if (supabaseUser) {
            const isWinning = updatedAuction.current_winner_id === supabaseUser.id;
            setIsMyBid(prevIsMyBid => {
              if (isWinning !== prevIsMyBid) {
                console.log(isWinning ? '✅ あなたが最高入札者です' : '⚠️ 他のユーザーが最高入札者です');
              }
              return isWinning;
            });
          }
        }
      } catch (err) {
        console.error('❌ ポーリングエラー:', err);
      }
    };

    // 初回実行
    fetchAuctionUpdate();

    // 3秒ごとにポーリング
    const intervalId = setInterval(fetchAuctionUpdate, 3000);

    // クリーンアップ
    return () => {
      console.log('🔵 ポーリング停止:', auctionId);
      clearInterval(intervalId);
    };
  }, [auctionId, supabaseUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!talk) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Talk枠が見つかりません</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600"
          >
            ホームに戻る
          </button>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const formatted = date.toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    console.log('📅 Talk時刻表示:', { input: dateString, output: formatted });
    return formatted;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ja-JP').format(price);
  };

  // 与信確保と入札処理
  const processBid = async (bidAmount: number) => {
    if (!user || !supabaseUser || !talk) {
      throw new Error('ユーザー情報またはTalk情報が見つかりません');
    }

    console.log('🔵 入札処理開始:', {
      bidAmount,
      customerId: supabaseUser.stripe_customer_id,
      userId: supabaseUser.id,
      userEmail: user.email,
    });

    // stripe_customer_idが見つからない場合、データベースから直接取得
    let customerId = supabaseUser.stripe_customer_id;
    if (!customerId) {
      console.log('⚠️ stripe_customer_idが見つからないため、データベースから取得します');
      const { data: customerData, error: customerError } = await supabase
        .from('users')
        .select('stripe_customer_id')
        .eq('auth_user_id', user.id)
        .single();

      if (customerError || !customerData?.stripe_customer_id) {
        throw new Error('Stripe顧客IDが見つかりません。カード登録を再度お試しください。');
      }

      customerId = customerData.stripe_customer_id;
      console.log('✅ データベースから取得したstripe_customer_id:', customerId);
    }

    try {
      // 与信確保API呼び出し
      const { getBackendUrl } = await import('../lib/backend');
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/api/stripe/authorize-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: bidAmount,
          customerId: customerId,
          auctionId: auctionId,
          userId: supabaseUser.id, // ユーザーIDを追加
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '与信確保に失敗しました');
      }

      const { paymentIntentId } = await response.json();

      // 入札データをSupabaseに保存
      console.log('🔵 入札データ保存開始:', {
        auction_id: auctionId,
        call_slot_id: talk.id,
        user_id: supabaseUser.id,
        auth_user_id: user.id,
        bid_amount: bidAmount,
      });

      const { data: bidData, error: bidError } = await supabase
        .from('bids')
        .insert({
          auction_id: auctionId, // 正しいauction_idを使用
          user_id: supabaseUser.id,
          bid_amount: bidAmount,
          stripe_payment_intent_id: paymentIntentId,
          is_autobid: false,
        })
        .select();

      if (bidError) {
        console.error('❌ 入札保存エラー詳細:', bidError);
        throw new Error(`入札データの保存に失敗しました: ${bidError.message || bidError.code}`);
      }

      console.log('✅ 入札保存成功:', bidData);

      // オークション情報を更新（最高入札額と入札者を記録）
      // RPC関数を使用（元の実装に戻す）
      const { error: updateError } = await supabase.rpc(
        'update_auction_highest_bid',
        {
          p_auction_id: auctionId,
          p_bid_amount: Number(bidAmount),
          p_user_id: supabaseUser.id,
        }
      );

      if (updateError) {
        console.error('❌ オークション更新エラー:', updateError);
        throw new Error(`オークション情報の更新に失敗しました: ${updateError.message}`);
      }

      console.log('✅ オークション情報更新成功');

      // UI更新（リアルタイムサブスクリプションでも更新されるが、即座に反映）
      setCurrentHighestBid(bidAmount);
      setIsMyBid(true);
      alert(`✅ ¥${formatPrice(bidAmount)} で入札しました！`);
    } catch (error: any) {
      console.error('入札処理エラー:', error);
      throw error;
    }
  };

  const processBuyNow = async (buyNowPrice: number) => {
    if (!user || !supabaseUser) {
      throw new Error('ログインが必要です');
    }

    try {
      console.log('🔵 即決購入処理開始:', { buyNowPrice, auctionId });

      // Stripe PaymentIntentを作成して与信確保
      const { data: customerData } = await supabase
        .from('users')
        .select('stripe_customer_id')
        .eq('id', supabaseUser.id)
        .single();

      if (!customerData?.stripe_customer_id) {
        throw new Error('顧客情報が見つかりません');
      }

      const { getBackendUrl } = await import('../lib/backend');
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/api/stripe/authorize-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: buyNowPrice,
          customerId: customerData.stripe_customer_id,
          auctionId: auctionId,
          userId: supabaseUser.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '与信確保に失敗しました');
      }

      const { paymentIntentId } = await response.json();

      // 即決購入APIを呼び出し
      const buyNowResponse = await fetch(`${backendUrl}/api/buy-now`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auctionId,
          userId: supabaseUser.id,
          buyNowPrice,
          paymentIntentId,
        }),
      });

      if (!buyNowResponse.ok) {
        const error = await buyNowResponse.json();
        throw new Error(error.error || '即決購入に失敗しました');
      }

      console.log('✅ 即決購入成功');
    } catch (error: any) {
      console.error('即決購入エラー:', error);
      throw error;
    }
  };

  const handleBid = async (increment: number) => {
    const newBidAmount = currentHighestBid + increment;
    
    console.log('🔵 入札ボタンクリック:', {
      newBidAmount,
      hasUser: !!user,
      hasSupabaseUser: !!supabaseUser,
      hasPaymentMethod: supabaseUser?.has_payment_method,
    });
    
    // ステップ1: ログインチェック
    if (!user || !supabaseUser) {
      setPendingBidAmount(newBidAmount);
      setShowAuthModal(true);
      return;
    }
    
    // ステップ2: カード登録チェック
    if (!supabaseUser.has_payment_method) {
      console.log('⚠️ カード未登録のため、モーダルを表示');
      setPendingBidAmount(newBidAmount);
      setShowCardModal(true);
      return;
    }
    
    // ステップ3: 与信確保を試行
    try {
      await processBid(newBidAmount);
    } catch (error: any) {
      alert(`入札に失敗しました: ${error.message}`);
    }
  };

  const handleCustomBid = async () => {
    const amount = parseInt(customAmount);

    if (amount <= currentHighestBid) {
      alert('現在の最高価格より高い金額を入力してください');
      return;
    }

    // ステップ1: ログインチェック
    if (!user || !supabaseUser) {
      setPendingBidAmount(amount);
      setShowAuthModal(true);
      return;
    }

    // ステップ2: カード登録チェック
    if (!supabaseUser.has_payment_method) {
      setPendingBidAmount(amount);
      setShowCardModal(true);
      return;
    }

    // ステップ3: 与信確保を試行
    try {
      await processBid(amount);
      setShowCustomInput(false);
      setCustomAmount('');
    } catch (error: any) {
      alert(`入札に失敗しました: ${error.message}`);
    }
  };

  const handleBuyNow = async () => {
    if (!talk.buy_now_price) return;

    const buyNowPrice = talk.buy_now_price;

    // ステップ1: ログインチェック
    if (!user || !supabaseUser) {
      setPendingBidAmount(buyNowPrice);
      setShowAuthModal(true);
      return;
    }

    // ステップ2: カード登録チェック
    if (!supabaseUser.has_payment_method) {
      setPendingBidAmount(buyNowPrice);
      setShowCardModal(true);
      return;
    }

    // 確認ダイアログ
    if (!confirm(`即決価格 ¥${formatPrice(buyNowPrice)} で落札しますか？\nこの操作は取り消せません。`)) {
      return;
    }

    // ステップ3: 即決購入を実行
    try {
      await processBuyNow(buyNowPrice);
      alert(`✅ ¥${formatPrice(buyNowPrice)} で即決落札しました！`);
      // ページをリロードしてオークション終了画面を表示
      window.location.reload();
    } catch (error: any) {
      alert(`即決落札に失敗しました: ${error.message}`);
    }
  };

  // 認証完了後のコールバック
  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    // 認証後、カード登録が必要
    if (pendingBidAmount > 0) {
      setShowCardModal(true);
    }
  };

  // カード登録完了後のコールバック
  const handleCardRegistrationSuccess = async () => {
    setShowCardModal(false);
    console.log('🔵 カード登録成功コールバック');
    
    // カード登録後、保留していた入札を実行
    if (pendingBidAmount > 0) {
      try {
        // ユーザー情報を再取得してから入札処理（重要！）
        console.log('🔵 ユーザー情報を再取得してhas_payment_methodを更新...');
        await refreshUser();
        
        // さらに1秒待機してSupabaseの同期を確実に
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('🔵 入札処理を開始...');
        await processBid(pendingBidAmount);
        setPendingBidAmount(0);
      } catch (error: any) {
        alert(`入札に失敗しました: ${error.message}`);
      }
    }
  };

  const quickBidOptions = [10, 100, 1000];

  // オークション終了後の画面
  if (auctionStatus === 'ended') {
    return (
      <div
        className="min-h-screen relative flex items-center justify-center p-4"
        style={{
          backgroundImage: `url(${talk.detail_image_url || talk.influencer.avatar_url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* 背景のオーバーレイ */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-lg"></div>

        {/* メインコンテンツ */}
        <div className="relative z-10 bg-white rounded-3xl p-8 max-w-2xl w-full text-center shadow-2xl">
          {isWinner ? (
            <>
              {/* 落札者向けメッセージ */}
              <div className="mb-8">
                <div className="text-8xl mb-6 animate-bounce">🎉</div>
                <h1 className="text-4xl md:text-5xl font-bold text-pink-600 mb-4">
                  おめでとうございます！
                </h1>
                <p className="text-2xl text-gray-800 mb-6">
                  オークションに落札されました
                </p>
                <p className="text-gray-600 mb-6">
                  Talk一覧で予定を確認できます。<br />
                  通話開始時刻になりましたら、通知が届きます。
                </p>
              </div>
              <button
                onClick={() => navigate('/talk')}
                className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:from-pink-600 hover:to-purple-700 transition-all duration-200 shadow-lg"
              >
                Talk予定を確認する
              </button>
            </>
          ) : userHasBid ? (
            <>
              {/* 入札者（非落札者）向けメッセージ */}
              <div className="mb-8">
                <div className="text-8xl mb-6">😢</div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
                  残念！
                </h1>
                <p className="text-xl text-gray-700 mb-6">
                  このTalkは別の方が落札されました
                </p>
                <p className="text-gray-600 mb-6">
                  次回は落札できますように！<br />
                  {talk.influencer.name}さんの他のTalk枠もチェックしてみてください。
                </p>
              </div>
              <button
                onClick={() => navigate(`/i/${talk.influencer_id}`)}
                className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:from-pink-600 hover:to-purple-700 transition-all duration-200 shadow-lg"
              >
                他の枠をチェックする
              </button>
            </>
          ) : (
            <>
              {/* 閲覧者（非入札者）向けメッセージ */}
              <div className="mb-8">
                <div className="text-8xl mb-6">📭</div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
                  オークション終了
                </h1>
                <p className="text-xl text-gray-700 mb-6">
                  このTalk枠のオークションは終了しました
                </p>
                <p className="text-gray-600 mb-6">
                  他にも魅力的なTalk枠がたくさんあります。<br />
                  ぜひチェックしてみてください！
                </p>
              </div>
              <button
                onClick={() => navigate('/')}
                className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:from-pink-600 hover:to-purple-700 transition-all duration-200 shadow-lg"
              >
                他のTalk枠を見る
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // オークション進行中の画面
  return (
    <div className="min-h-screen flex flex-col -mx-4 sm:-mx-6 lg:-mx-8 -mt-12 pb-12 md:pb-0">
      {/* Hero Section with Host Photo */}
      <div className="relative flex-1 min-h-[calc(100vh-48px-48px)] overflow-hidden">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover"
          style={{
            backgroundImage: `url(${talk.detail_image_url || talk.influencer.avatar_url})`,
            backgroundPosition: 'center top',
            backgroundAttachment: 'scroll'
          }}
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />

        {/* Top Bar with Back Button and Host Name */}
        <div className="absolute top-16 left-4 right-4 z-10 flex items-center space-x-4">
          {/* Back Button */}
          <button
            onClick={() => navigate('/')}
            className="bg-black/50 backdrop-blur-sm text-white p-3 rounded-full hover:bg-black/70 transition-all duration-200 flex-shrink-0"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>

          {/* Share Button */}
          <button
            onClick={() => {
              const url = window.location.href;
              navigator.clipboard.writeText(url);
              alert('URLをコピーしました！SNSでシェアしてください🎉');
            }}
            className="bg-black/50 backdrop-blur-sm text-white p-3 rounded-full hover:bg-black/70 transition-all duration-200 flex-shrink-0"
            title="URLをコピー"
          >
            <Share2 className="h-6 w-6" />
          </button>

          {/* Host Name with Avatar - Clickable */}
          <button
            onClick={() => navigate(`/i/${talk.influencer_id}`)}
            className="flex-1 flex items-center space-x-3 hover:opacity-80 transition-opacity"
          >
            <img
              src={talk.influencer.avatar_url}
              alt={talk.influencer.name}
              className="h-12 w-12 md:h-14 md:w-14 rounded-full border-2 border-white shadow-lg object-cover flex-shrink-0"
            />
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white drop-shadow-lg truncate">
              {talk.influencer.name}
            </h1>
          </button>
        </div>

        {/* Host Message and Bidding Section - Bottom */}
        <div className="absolute bottom-4 left-4 right-4 z-10 space-y-3">
          {/* Host Message */}
          <div className="text-center">
            <p className="text-sm md:text-base text-white drop-shadow-md bg-black/20 backdrop-blur-sm rounded-lg px-3 py-2 inline-block">
              {talk.host_message}
            </p>
          </div>

          {/* Payment Timing Explanation */}
          <div className="bg-blue-500/90 backdrop-blur-sm border-2 border-blue-300 rounded-xl p-3 shadow-lg">
            <div className="flex items-start space-x-2">
              <Info className="h-5 w-5 text-white flex-shrink-0 mt-0.5" />
              <div className="text-sm text-white">
                <p className="font-bold mb-1">💡 お支払いのタイミング</p>
                <p className="text-xs leading-relaxed">
                  入札時点では料金は発生しません。<br />
                  <span className="font-bold">最終落札者として落札し、Talkが実施されたあと</span>に登録済みのクレジットカードから決済されます。
                </p>
              </div>
            </div>
          </div>

          {/* Quick Bid Buttons */}
          <div className="flex space-x-2 justify-center">
            {quickBidOptions.map((increment) => (
              <button
                key={increment}
                onClick={() => handleBid(increment)}
                className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-5 py-3 rounded-full font-bold hover:from-pink-600 hover:to-purple-700 transition-all duration-200 shadow-lg text-base"
              >
                +¥{increment}
              </button>
            ))}
            <button
              onClick={() => setShowCustomInput(true)}
              className="bg-gradient-to-r from-pink-500 to-purple-600 text-white p-3 rounded-full hover:from-pink-600 hover:to-purple-700 transition-all duration-200 shadow-lg"
            >
              <Edit3 className="h-6 w-6" />
            </button>
          </div>

          {/* Buy Now Button */}
          {talk.buy_now_price && (
            <div className="flex justify-center">
              <button
                onClick={() => handleBuyNow()}
                className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white px-8 py-3 rounded-full font-bold hover:from-purple-700 hover:to-indigo-800 transition-all duration-200 shadow-lg text-base flex items-center space-x-2"
              >
                <span>⚡</span>
                <span>即決で落札（¥{formatPrice(talk.buy_now_price)}）</span>
              </button>
            </div>
          )}

          {/* Current Highest Price */}
          <div className={`backdrop-blur-sm rounded-xl p-3 shadow-lg transition-colors duration-300 ${
            isMyBid ? 'bg-green-100 border-2 border-green-300' : 'bg-white/90'
          }`}>
            <div className="flex items-center">
              <div className="text-center flex-1">
                <p className="text-xs text-gray-600 mb-1">現在の最高価格</p>
                <p className={`text-xl font-bold flex items-center justify-center ${
                  isMyBid ? 'text-green-600' : 'text-pink-600'
                }`}>
                  ¥{formatPrice(currentHighestBid)}
                  {isMyBid && <span className="ml-2 text-sm bg-green-200 text-green-800 px-2 py-1 rounded-full">You</span>}
                </p>
                {talk.buy_now_price && (
                  <p className="text-xs text-gray-500 mt-1">
                    即決価格: <span className="font-bold text-purple-600">¥{formatPrice(talk.buy_now_price)}</span>
                  </p>
                )}
              </div>
              <button
                onClick={() => navigate(`/bid-history/${talkId}`)}
                className="p-2 text-gray-600 hover:text-pink-600 transition-colors flex-shrink-0"
                title="入札履歴を見る"
              >
                <History className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Talk Schedule - Below Photo */}
      <div className="bg-white p-4 md:p-6 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-pink-500" />
            <span className="font-medium text-gray-700">Talk予定時間</span>
            {talk.is_female_only && (
              <span className="bg-pink-100 text-pink-600 px-2 py-1 rounded-full text-xs font-medium">
                女性限定
              </span>
            )}
          </div>
          <CountdownTimer
            targetTime={talk.auction_end_time}
            className="text-sm"
            showSeconds={true}
          />
        </div>
        <p className="text-lg font-medium text-gray-800 mt-2">
          {formatDate(talk.start_time)} - {formatDate(talk.end_time)}
        </p>
        {talk.description && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Talk枠の説明</h3>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
              {talk.description}
            </p>
          </div>
        )}
      </div>

      {/* Custom Bid Input Modal */}
      {showCustomInput && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-xl font-bold text-gray-800 mb-4">カスタム入札</h3>
            <p className="text-sm text-gray-600 mb-4">
              現在の最高価格: ¥{formatPrice(currentHighestBid)}
            </p>
            <input
              type="number"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder="入札金額を入力"
              className="w-full p-3 border border-gray-200 rounded-lg mb-4 text-lg"
              min={currentHighestBid + 1}
            />
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowCustomInput(false);
                  setCustomAmount('');
                }}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleCustomBid}
                className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all duration-200"
              >
                入札する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Card Registration Modal */}
      <CardRegistrationModal
        isOpen={showCardModal}
        onClose={() => setShowCardModal(false)}
        onSuccess={handleCardRegistrationSuccess}
      />

    </div>
  );
}