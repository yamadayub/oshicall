# ドキュメント整理 完了報告

## 作業完了日
2025-01-XX

## 実施した作業

### ✅ Step 1: 現状分析
- `/docs`配下の全ファイルを確認
- 分類案を作成（`archive/DOCUMENT_REORGANIZATION_PLAN.md`に保存）

### ✅ Step 2: 業務仕様の抽出・作成
以下の業務仕様ファイルを作成しました：

1. **`/docs/business/auction.md`** ✅
   - オークション業務のビジネスルール
   - BR-001から抽出

2. **`/docs/business/video-call.md`** ✅
   - ビデオ通話業務のビジネスルール
   - BR-002とcall-status-management.mdから抽出

3. **`/docs/business/payment.md`** ✅
   - 決済業務のビジネスルール
   - BR-003から抽出

4. **`/docs/business/user-management.md`** ✅
   - ユーザー管理業務のビジネスルール
   - BR-004, BR-005, BR-006, BR-007を統合

5. **`/docs/business/glossary.md`** ✅
   - 用語集（requirements/glossary.mdから移動）

6. **`/docs/business/README.md`** ✅
   - 業務仕様ドキュメントの説明

### ✅ Step 3: テスト計画の整理
- `/docs/test/plans/`ディレクトリを作成
- `CALL_STATUS_MANAGEMENT_TEST_PLAN.md`を`plans/call-status-management_TEST_PLAN.md`に移動

### ✅ Step 4: 機能仕様の整理
- `/docs/functional/functions/`サブディレクトリを削除
- 各機能仕様ファイルを`/docs/functional/`直下に移動
- `call-status-management.md`を`/docs/functional/`に移動
- 各機能仕様ファイルに「対応する業務仕様」セクションを追加
- `/docs/functional/README.md`を更新

### ✅ Step 5: その他の整理
- `/docs/api/`配下のファイルを`/docs/functional/`に移動
- `/docs/development/`配下のファイルを`/docs/archive/`に移動
- `/docs/guides/`配下のファイルを適切な場所に移動
  - セットアップ関連 → `/docs/setup/`
  - 完了した作業記録 → `/docs/archive/`
- `/docs/troubleshooting/`を`/docs/setup/troubleshooting/`に移動
- `/docs/user_guide/`を`/docs/setup/user_guide/`に移動
- `/docs/deployment/`配下のファイルを`/docs/setup/`に移動
- `/docs/CODE_CHANGE_WORKFLOW.md`を`/docs/ai_workflow/`に移動

### ✅ Step 6: 旧ファイルの削除
- `/docs/requirements/`ディレクトリを削除（業務仕様は`/docs/business/`に移動済み）

### ✅ Step 7: ドキュメント更新
- `/docs/README.md`を新しい構造に合わせて更新

## 新しいディレクトリ構造

```
docs/
├── business/                    # 業務仕様（原本）✅
│   ├── README.md
│   ├── auction.md
│   ├── video-call.md
│   ├── payment.md
│   ├── user-management.md
│   └── glossary.md
│
├── functional/                  # 機能仕様（実装方針）✅
│   ├── README.md
│   ├── auction.md
│   ├── talk.md
│   ├── payment.md
│   ├── authentication.md
│   ├── influencer.md
│   ├── follow.md
│   ├── ranking.md
│   ├── call-status-management.md
│   └── [その他技術仕様]
│
├── test/                        # テスト関連✅
│   ├── plans/                   # テスト計画書
│   │   └── call-status-management_TEST_PLAN.md
│   ├── E2E_TEST_GUIDE.md
│   └── TEST_ACCOUNTS.md
│
├── setup/                       # セットアップガイド✅
│   ├── troubleshooting/
│   └── user_guide/
│
├── archive/                     # 過去のドキュメント✅
│
└── ai_workflow/                 # AI開発プロセス✅
    ├── AI_TDD_PROCESS_v3.md
    └── CODE_CHANGE_WORKFLOW.md
```

## 注意事項

### 内部リンクの更新が必要なファイル

以下のファイルは、古いパスへのリンクが残っている可能性があります：
- `/docs/archive/`配下の旧requirements/ファイル（参照専用のため更新不要）
- その他のドキュメント内のリンク（必要に応じて更新）

### 今後のメンテナンス

1. 新規業務仕様追加時: `/docs/business/`に作成
2. 新規機能仕様追加時: `/docs/functional/`に作成
3. 新規テスト計画追加時: `/docs/test/plans/`に作成
4. 完了した作業記録: `/docs/archive/`に移動

---

**作業完了日**: 2025-01-XX
**作業者**: AI Assistant

