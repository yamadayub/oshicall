#!/bin/bash

# MCP環境切り替えスクリプト
# 使用方法: ./scripts/switch-mcp-env.sh [staging|dev]

ENV=$1

if [ -z "$ENV" ]; then
    echo "❌ 使用方法: ./scripts/switch-mcp-env.sh [staging|dev]"
    echo ""
    echo "現在の設定:"
    if [ -f .cursor/mcp.json ]; then
        PROJECT_REF=$(grep -o 'project_ref=[^"]*' .cursor/mcp.json | cut -d= -f2)
        if [ "$PROJECT_REF" = "wioealhsienyubwegvdu" ]; then
            echo "  → Staging環境 (wioealhsienyubwegvdu)"
        elif [ "$PROJECT_REF" = "bpmarxvgryqhjfmqqdlg" ]; then
            echo "  → Dev環境 (bpmarxvgryqhjfmqqdlg)"
        else
            echo "  → 不明な環境 ($PROJECT_REF)"
        fi
    else
        echo "  → 設定ファイルが見つかりません"
    fi
    exit 1
fi

case $ENV in
  staging)
    if [ -f .cursor/mcp.json.staging ]; then
        cp .cursor/mcp.json.staging .cursor/mcp.json
        echo "✅ MCP環境をStagingに切り替えました"
        echo "   PROJECT_REF: wioealhsienyubwegvdu"
    else
        echo "❌ .cursor/mcp.json.staging が見つかりません"
        exit 1
    fi
    ;;
  production)
    if [ -f .cursor/mcp.json.production ]; then
        cp .cursor/mcp.json.production .cursor/mcp.json
        echo "✅ MCP環境をProductionに切り替えました"
        echo "   PROJECT_REF: atkhwwqunwmpzqkgavtx"
    else
        echo "❌ .cursor/mcp.json.production が見つかりません"
        exit 1
    fi
    ;;
  dev)
    if [ -f .cursor/mcp.json.dev ]; then
        cp .cursor/mcp.json.dev .cursor/mcp.json
        echo "✅ MCP環境をDevに切り替えました"
        echo "   PROJECT_REF: bpmarxvgryqhjfmqqdlg"
    else
        echo "❌ .cursor/mcp.json.dev が見つかりません"
        exit 1
    fi
    ;;
  *)
    echo "❌ 無効な環境: $ENV"
    echo "   使用可能な環境: staging, production, dev"
    exit 1
    ;;
esac

echo ""
echo "⚠️  Cursorを再起動して設定を反映してください"


