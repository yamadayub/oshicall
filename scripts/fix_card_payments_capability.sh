#!/bin/bash

# Stripe Connectアカウントにcard_payments capabilityをリクエストするスクリプト
#
# 使用方法:
#   export STRIPE_SECRET_KEY="sk_test_xxxxx"
#   ./scripts/fix_card_payments_capability.sh <connect_account_id>
#
# 例:
#   export STRIPE_SECRET_KEY="sk_test_xxxxx"
#   ./scripts/fix_card_payments_capability.sh acct_1SKrTLDYeJjwCo3O

CONNECT_ACCOUNT_ID=$1

if [ -z "$CONNECT_ACCOUNT_ID" ]; then
  echo "❌ ConnectアカウントIDを指定してください"
  echo "使用方法: ./scripts/fix_card_payments_capability.sh <connect_account_id>"
  echo "環境変数STRIPE_SECRET_KEYを設定してください"
  exit 1
fi

if [ -z "$STRIPE_SECRET_KEY" ]; then
  echo "❌ 環境変数STRIPE_SECRET_KEYが設定されていません"
  echo "使用方法: export STRIPE_SECRET_KEY=\"sk_test_xxxxx\""
  exit 1
fi

echo "🔵 card_payments capabilityをリクエスト中..."
echo "Connect Account ID: $CONNECT_ACCOUNT_ID"
echo ""

# Stripe APIでcard_payments capabilityをリクエスト
RESPONSE=$(curl -s -X POST "https://api.stripe.com/v1/accounts/$CONNECT_ACCOUNT_ID" \
  -u "$STRIPE_SECRET_KEY:" \
  -d "capabilities[card_payments][requested]=true")

# レスポンスを確認
if echo "$RESPONSE" | grep -q '"error"'; then
  echo "❌ エラーが発生しました:"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
  exit 1
else
  echo "✅ card_payments capabilityのリクエストが成功しました"
  echo ""
  echo "📋 更新後のcapabilities:"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null | grep -A 5 '"capabilities"' || echo "$RESPONSE"
  echo ""
  echo "⚠️  注意: capabilityが'active'になるまで時間がかかる場合があります"
  echo "   状態を確認するには以下のコマンドを実行してください:"
  echo "   curl https://api.stripe.com/v1/accounts/$CONNECT_ACCOUNT_ID -u \$STRIPE_SECRET_KEY: | python3 -m json.tool | grep -A 5 capabilities"
fi

