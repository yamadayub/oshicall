import { loadStripe } from '@stripe/stripe-js';

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

if (!publishableKey) {
  console.error('❌ VITE_STRIPE_PUBLISHABLE_KEYが設定されていません');
}

const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

if (stripePromise) {
  stripePromise.catch((error) => {
    console.error('❌ Stripe読み込みエラー:', error);
  });
}

export default stripePromise;

