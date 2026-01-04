#!/bin/bash

# Stripe Connectアカウントにcard_payments capabilityをリクエストするスクリプト
#
# 使用方法:
#   ./scripts/request_card_payments_capability.sh <connect_account_id> <stripe_secret_key>
#
# 例:
#   ./scripts/request_card_payments_capability.sh acct_1SKrTLDYeJjwCo3O sk_test_xxxxx

CONNECT_ACCOUNT_ID=$1
STRIPE_SECRET_KEY=$2

if [ -z "$CONNECT_ACCOUNT_ID" ] || [ -z "$STRIPE_SECRET_KEY" ]; then
  echo "❌ 使用方法: $0 <connect_account_id> <stripe_secret_key>"
  exit 1
fi

echo "🔵 card_payments capabilityをリクエスト中..."
echo "Connect Account ID: $CONNECT_ACCOUNT_ID"

# Stripe APIでcard_payments capabilityをリクエスト
RESPONSE=$(curl -s -X POST "https://api.stripe.com/v1/accounts/$CONNECT_ACCOUNT_ID" \
  -u "$STRIPE_SECRET_KEY:" \
  -d "capabilities[card_payments][requested]=true")

# レスポンスを確認
if echo "$RESPONSE" | grep -q '"error"'; then
  echo "❌ エラーが発生しました:"
  echo "$RESPONSE" | jq '.'
  exit 1
else
  echo "✅ card_payments capabilityのリクエストが成功しました"
  echo ""
  echo "📋 更新後のcapabilities:"
  echo "$RESPONSE" | jq '.capabilities'
  echo ""
  echo "⚠️  注意: capabilityが'active'になるまで時間がかかる場合があります"
  echo "   状態を確認するには: curl https://api.stripe.com/v1/accounts/$CONNECT_ACCOUNT_ID -u $STRIPE_SECRET_KEY: | jq '.capabilities'"
fi

