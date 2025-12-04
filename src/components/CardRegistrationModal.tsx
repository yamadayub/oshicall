import React, { useState } from 'react';
import { X, CreditCard } from 'lucide-react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import stripePromise from '../lib/stripe';
import { createStripeCustomer, createSetupIntent, confirmPaymentMethod } from '../api/stripe';
import { useAuth } from '../contexts/AuthContext';

interface CardRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function CardRegistrationForm({ onClose, onSuccess }: Omit<CardRegistrationModalProps, 'isOpen'>) {
  const stripe = useStripe();
  const elements = useElements();
  const { user, supabaseUser, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements || !user || !supabaseUser) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      // 1. Stripe顧客を作成（まだ作成されていない場合）
      let customerId = supabaseUser.stripe_customer_id;
      
      if (!customerId) {
        const customerResult = await createStripeCustomer(
          user.email || '',
          supabaseUser.display_name,
          user.id
        );
        customerId = customerResult.customerId;
      }

      // 2. Setup Intentを作成
      const { clientSecret } = await createSetupIntent(customerId);

      // 3. カード情報を送信
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('カード情報の取得に失敗しました');
      }

      const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: supabaseUser.display_name,
              email: user.email || undefined,
            },
          },
        }
      );

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      if (setupIntent.status === 'succeeded') {
        // 4. デフォルト支払い方法として設定
        const { getBackendUrl } = await import('../lib/backend');
        const backendUrl = getBackendUrl();
        await fetch(`${backendUrl}/api/stripe/set-default-payment-method`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId,
            paymentMethodId: setupIntent.payment_method,
          }),
        });

        // 5. カード登録完了をSupabaseに記録
        console.log('🔵 カード登録完了をSupabaseに記録:', user.id);
        await confirmPaymentMethod(user.id);

        // 6. ユーザー情報を再取得（確実に更新されるまで待つ）
        console.log('🔵 ユーザー情報を再取得中...');
        await refreshUser();
        
        // 少し待機してから次の処理へ（Supabase同期を確実にする）
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('✅ カード登録完了！');

        onSuccess();
      }
    } catch (err: any) {
      console.error('カード登録エラー:', err);
      setError(err.message || 'カード登録に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          クレジットカード情報
        </label>
        <div className="p-4 border border-gray-300 rounded-lg bg-white">
          <div id="card-element-wrapper" style={{ pointerEvents: 'auto' }}>
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#424770',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    '::placeholder': {
                      color: '#aab7c4',
                    },
                  },
                  invalid: {
                    color: '#9e2146',
                  },
                },
                hidePostalCode: true,
              }}
            />
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          💳 テストカード番号: 4242 4242 4242 4242 (有効期限: 任意の未来日付, CVC: 任意の3桁)
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="flex space-x-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          disabled={loading}
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={!stripe || loading}
          className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg font-medium hover:from-pink-600 hover:to-purple-700 transition-all duration-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '登録中...' : 'カードを登録'}
        </button>
      </div>
    </form>
  );
}

export default function CardRegistrationModal({ isOpen, onClose, onSuccess }: CardRegistrationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" style={{ pointerEvents: 'auto' }}>
      <div className="bg-white rounded-2xl max-w-md w-full p-8 relative shadow-2xl" style={{ pointerEvents: 'auto' }}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full mb-4">
            <CreditCard className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            クレジットカード登録
          </h2>
          <p className="text-sm text-gray-600 mt-2">
            入札にはクレジットカードの登録が必要です
          </p>
        </div>

        <Elements 
          stripe={stripePromise}
          options={{
            appearance: {
              theme: 'stripe',
            },
          }}
        >
          <CardRegistrationForm onClose={onClose} onSuccess={onSuccess} />
        </Elements>
      </div>
    </div>
  );
}

