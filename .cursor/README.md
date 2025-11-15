# Cursor MCP設定

このディレクトリには、このプロジェクト専用のCursor MCPサーバー設定が含まれています。

## 設定ファイル

- `mcp.json`: 現在アクティブなMCPサーバー設定（デフォルト: Staging環境）
- `mcp.json.staging`: Staging環境用のテンプレート
- `mcp.json.dev`: Dev環境用のテンプレート

## 環境切り替え

### 簡単な方法（推奨）

プロジェクトルートで以下のコマンドを実行：

```bash
# Staging環境に切り替え
./scripts/switch-mcp-env.sh staging

# Dev環境に切り替え
./scripts/switch-mcp-env.sh dev
```

### 手動で切り替える場合

```bash
# Staging環境
cp .cursor/mcp.json.staging .cursor/mcp.json

# Dev環境
cp .cursor/mcp.json.dev .cursor/mcp.json
```

## 現在の環境

- **Staging**: `wioealhsienyubwegvdu` (デフォルト)
- **Dev**: `bpmarxvgryqhjfmqqdlg`

## 注意事項

- プロジェクトレベルの設定（`.cursor/mcp.json`）は、グローバル設定（`~/.cursor/mcp.json`）よりも優先されます
- 環境を切り替えた後は、**Cursorを再起動**してください
- この設定ファイルはプロジェクトごとに独立しているため、他のプロジェクトに影響しません
- `mcp.json` はGit管理に含まれます（デフォルトはStaging環境）
