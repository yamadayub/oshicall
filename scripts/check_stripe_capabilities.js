#!/usr/bin/env node

/**
 * Stripe Connectアカウントのcapabilitiesを確認するスクリプト
 * 
 * 使用方法:
 *   node scripts/check_stripe_capabilities.js <connect_account_id>
 * 
 * 例:
 *   node scripts/check_stripe_capabilities.js acct_1SKrTLDYeJjwCo3O
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY_STAGING);

const connectAccountId = process.argv[2];

if (!connectAccountId) {
  console.error('❌ ConnectアカウントIDを指定してください');
  console.log('使用方法: node scripts/check_stripe_capabilities.js <connect_account_id>');
  process.exit(1);
}

async function checkCapabilities() {
  try {
    console.log('🔵 Connectアカウントのcapabilitiesを確認中...');
    console.log('アカウントID:', connectAccountId);
    
    const account = await stripe.accounts.retrieve(connectAccountId);
    
    console.log('\n✅ アカウント情報:');
    console.log('  ID:', account.id);
    console.log('  Type:', account.type);
    console.log('  Charges Enabled:', account.charges_enabled);
    console.log('  Payouts Enabled:', account.payouts_enabled);
    console.log('  Details Submitted:', account.details_submitted);
    
    console.log('\n📋 Capabilities:');
    if (account.capabilities) {
      Object.entries(account.capabilities).forEach(([key, value]) => {
        const status = value === 'active' ? '✅' : value === 'pending' ? '⏳' : '❌';
        console.log(`  ${status} ${key}: ${value}`);
      });
    } else {
      console.log('  (capabilities情報が取得できませんでした)');
    }
    
    // Destination Charges方式が使用可能かチェック
    const canUseDestinationCharges = 
      account.capabilities?.card_payments === 'active' &&
      account.capabilities?.transfers === 'active' &&
      account.charges_enabled === true &&
      account.payouts_enabled === true;
    
    console.log('\n🎯 Destination Charges方式の使用可能性:');
    if (canUseDestinationCharges) {
      console.log('  ✅ 使用可能');
    } else {
      console.log('  ❌ 使用不可');
      console.log('\n  理由:');
      if (account.capabilities?.card_payments !== 'active') {
        console.log('    - card_payments capabilityがactiveではありません');
        console.log(`      現在の状態: ${account.capabilities?.card_payments || '未設定'}`);
      }
      if (account.capabilities?.transfers !== 'active') {
        console.log('    - transfers capabilityがactiveではありません');
        console.log(`      現在の状態: ${account.capabilities?.transfers || '未設定'}`);
      }
      if (!account.charges_enabled) {
        console.log('    - charges_enabledがfalseです');
      }
      if (!account.payouts_enabled) {
        console.log('    - payouts_enabledがfalseです');
      }
    }
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
    if (error.type === 'StripeInvalidRequestError') {
      console.error('   詳細:', error.raw?.message);
    }
    process.exit(1);
  }
}

checkCapabilities();

