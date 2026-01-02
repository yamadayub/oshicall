# AI Agent 活用開発ガイドライン (Best Practices)

このドキュメントでは、Antigravity (AI Agent)、Gemini、Git worktreeを活用した、個人開発における効率的かつ安全な開発フローを定義します。

## 🎯 目的
- **AIの最大活用**: コーディング、テスト、ドキュメント作成をAIに任せる。
- **安全性**: DB破壊や予期せぬバグを防ぐ。
- **並行開発**: Git worktreeを使い、メイン環境を汚さずにAIにタスクを依頼する。

---

## 🛠️ ツールと役割

| ツール | 役割 | 使いどころ |
|--------|------|------------|
| **Antigravity** | **実行部隊 (Hands)** | コードの記述、コマンド実行、ブラウザ操作、テスト実行。 |
| **Gemini 1.5 Pro** | **参謀 (Brain)** | 大規模なコンテキスト（全コード）を読み込んだ設計、リファクタリング提案、複雑なバグ調査。 |
| **Claude / ChatGPT** | **専門家 (Advisor)** | セカンドオピニオン、特定のアルゴリズム生成、コードレビュー。 |
| **Git Worktree** | **作業場 (Workspace)** | AI用の隔離された作業ディレクトリ。メインブランチを切り替えずに並行作業が可能。 |

---

## 🔄 開発ワークフロー

### 1. タスク定義 (Planning)
AIに作業を依頼する前に、タスクを明確にします。
`docs/ai_workflow/templates/IMPLEMENTATION_PLAN.md` をコピーして計画書を作成します。

```bash
cp docs/ai_workflow/templates/IMPLEMENTATION_PLAN.md docs/ai_plans/feat-new-function.md
```

### 2. 作業環境の準備 (Git Worktree)
メインの作業ディレクトリをクリーンに保つため、AI用の作業ディレクトリを作成します。

**推奨構成**:
プロジェクトルートの隣にWorktree用のディレクトリを作成し、それをエディタ（Cursor/VSCode）のワークスペースに追加します。

```bash
# 1. Worktreeの作成 (例: feat/new-function ブランチ)
git worktree add ../oshicall-feat-new-function -b feat/new-function

# 2. エディタでフォルダを追加
# VSCode/Cursor: "File" -> "Add Folder to Workspace..." で作成したディレクトリを選択
```

> **なぜWorktreeか？**
> ブランチ切り替え (`git checkout`) は、node_modulesの再インストールやビルドキャッシュの不整合を引き起こすことがあります。Worktreeなら完全に独立したディレクトリでAIに作業させ、自分はメイン環境でレビューや別作業ができます。

### 3. 実装と実行 (Execution)
Antigravityに指示を出します。

**プロンプト例**:
> 「`../oshicall-feat-new-function` ディレクトリで作業してください。`docs/ai_plans/feat-new-function.md` の計画に従って実装を進めてください。」

### 4. テストと検証 (Verification)
AIにブラウザを使ったテストを依頼します。

**自動化のアプローチ**:
1. **即時確認**: Antigravityの `browser_subagent` を使い、「ブラウザでログインして、このボタンを押して動作確認して」と指示。
2. **永続化**: Playwright等のテストコードをAIに書かせ、CIで回せるようにする。

```bash
# AIへの指示例
「今回の変更に対するE2EテストをPlaywrightで書いてください。scripts/e2e/ に保存してください。」
```

### 5. レビューとマージ
1. AIの作業が完了したら、メイン環境（またはGitHub）でDiffを確認。
2. 問題なければマージ。
3. Worktreeの削除。

```bash
git worktree remove ../oshicall-feat-new-function
git branch -d feat/new-function
```

### 6. GitHubへのPush（Routine化）
実装完了後は、必ずGitHubにPushします。

#### 手順
1. **変更ファイルの確認**
   ```bash
   git status
   ```

2. **関連ファイルのみをステージング**
   ```bash
   # 主要な変更ファイルのみを追加
   git add [変更したファイル]
   ```

3. **コミット**
   ```bash
   git commit -m "feat: [機能名] の実装

   - 変更内容1
   - 変更内容2
   - ドキュメント更新"
   ```

4. **Push**
   ```bash
   git push origin main
   ```

#### コミットメッセージのフォーマット
- `feat`: 新機能追加
- `fix`: バグ修正
- `docs`: ドキュメント更新
- `refactor`: リファクタリング
- `test`: テスト追加・修正
- `chore`: その他の変更

詳細は [/docs/ai_workflow/CODE_CHANGE_WORKFLOW.md](./CODE_CHANGE_WORKFLOW.md) の「フェーズ5: GitHubへのPush」を参照してください。

---

## 🛡️ 安全なDB変更フロー

DB変更（マイグレーション）は最も慎重に行う必要があります。**AIに直接本番DBを操作させてはいけません。**

### ルール
1. **直接実行禁止**: AIに `supabase db push` を本番環境に対して実行させない。
2. **マイグレーションファイル**: 必ずSQLファイルを作成させる。
3. **人間によるレビュー**: 生成されたSQLを目視確認する。

### フロー
1. **AI**: 「ユーザーテーブルにカラムを追加したいです」
2. **AI**: `supabase/migrations/2025xxxx_add_column.sql` を作成。
3. **User**: ファイルの中身を確認。
4. **User**: ローカル/Stagingで `supabase db push` を実行して確認。
5. **User**: 問題なければCommit & Push。

---

## 🤖 ブラウザテスト自動化 (Best Practice)

個人開発では手動テストの工数がボトルネックになります。

### 推奨構成
- **フレームワーク**: Playwright (高速、高機能)
- **ディレクトリ**: `tests/e2e/`

### AI活用法
「この機能のテストコードを書いて」と頼むだけでなく、**「このテストコードを実行して、失敗したら修正して」** というループをAIに回させることが重要です。

1. AIに実装させる。
2. AIにテストを書かせる。
3. AIにテストを実行させる (`npx playwright test`)。
4. エラーが出たらAIが自己修正する。

このサイクルをWorktree内で行うことで、メイン環境を汚さずに品質を担保できます。
