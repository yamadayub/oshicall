# MCPサーバー設定ガイド

## 概要

このプロジェクトでは、**プロジェクト単位でMCPサーバーを管理**することで、以下の問題を解決します：

1. ✅ プロジェクトが増えても設定が肥大化しない
2. ✅ プロジェクトごとに独立した設定が可能
3. ✅ 環境切り替えが簡単

## 設定方法

### 1. プロジェクトレベルの設定（推奨）

プロジェクト内の `.cursor/mcp.json` が使用されます。この設定は**グローバル設定よりも優先**されます。

#### 現在の設定

`.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp",
      "headers": {
        "x-supabase-project-ref": "${env:SUPABASE_PROJECT_REF}"
      }
    }
  }
}
```

#### 環境変数の設定

環境変数 `SUPABASE_PROJECT_REF` を設定することで、接続先のSupabaseプロジェクトを切り替えます。

**Staging環境を使用する場合:**
```bash
export SUPABASE_PROJECT_REF=wioealhsienyubwegvdu
```

**Dev環境を使用する場合:**
```bash
export SUPABASE_PROJECT_REF=bpmarxvgryqhjfmqqdlg
```

#### 永続的な設定（推奨）

`~/.zshrc` または `~/.bashrc` に追加：

```bash
# Oshicallプロジェクト用（Staging環境）
export SUPABASE_PROJECT_REF=wioealhsienyubwegvdu
```

設定後、ターミナルを再起動するか：
```bash
source ~/.zshrc  # zshの場合
# または
source ~/.bashrc  # bashの場合
```

### 2. グローバル設定（非推奨）

`~/.cursor/mcp.json` に設定を追加することもできますが、プロジェクトが増えると管理が煩雑になります。

## 環境切り替えスクリプト

プロジェクトルートに `switch-mcp-env.sh` を作成して、簡単に環境を切り替えられるようにすることもできます：

```bash
#!/bin/bash

ENV=$1

case $ENV in
  staging)
    export SUPABASE_PROJECT_REF=wioealhsienyubwegvdu
    echo "✅ MCP環境をStagingに切り替えました"
    ;;
  dev)
    export SUPABASE_PROJECT_REF=bpmarxvgryqhjfmqqdlg
    echo "✅ MCP環境をDevに切り替えました"
    ;;
  *)
    echo "❌ 使用方法: ./switch-mcp-env.sh [staging|dev]"
    exit 1
    ;;
esac

# 現在の環境を表示
echo "現在の環境: $ENV"
echo "PROJECT_REF: $SUPABASE_PROJECT_REF"
echo ""
echo "⚠️  Cursorを再起動して設定を反映してください"
```

## トラブルシューティング

### MCPサーバーがエラーになる

1. **環境変数が設定されているか確認:**
   ```bash
   echo $SUPABASE_PROJECT_REF
   ```

2. **Cursorを再起動:**
   環境変数を変更した後は、Cursorを完全に再起動してください。

3. **プロジェクト設定を確認:**
   `.cursor/mcp.json` が正しく配置されているか確認してください。

### 複数のプロジェクトで異なる環境を使いたい

各プロジェクトの `.cursor/mcp.json` で異なる環境変数名を使用するか、プロジェクトごとに異なるMCPサーバー名を使用できます：

```json
{
  "mcpServers": {
    "supabase-staging": {
      "url": "https://mcp.supabase.com/mcp",
      "headers": {
        "x-supabase-project-ref": "wioealhsienyubwegvdu"
      }
    },
    "supabase-dev": {
      "url": "https://mcp.supabase.com/mcp",
      "headers": {
        "x-supabase-project-ref": "bpmarxvgryqhjfmqqdlg"
      }
    }
  }
}
```

## ベストプラクティス

1. ✅ **プロジェクト単位で管理**: 各プロジェクトに `.cursor/mcp.json` を配置
2. ✅ **環境変数を使用**: 機密情報や環境固有の設定は環境変数で管理
3. ✅ **設定ファイルをGit管理**: `.cursor/mcp.json` はGitにコミット（環境変数は含めない）
4. ✅ **READMEに記載**: プロジェクトのREADMEにMCP設定方法を記載

## 参考

- [Cursor MCP Documentation](https://docs.cursor.com/context/mcp)
- [Supabase MCP Server](https://supabase.com/docs/guides/mcp)


