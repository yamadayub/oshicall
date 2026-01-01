# ドキュメント整理 進捗状況

## 完了した作業

### ✅ Step 1: 現状分析
- `/docs`配下の全ファイルを確認
- 分類案を作成（`DOCUMENT_REORGANIZATION_PLAN.md`）

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
- `/docs/functional/README.md`を更新

## 残りの作業

### ⏳ 機能仕様ファイルの内部リンク更新
既存の機能仕様ファイル（auction.md, talk.md等）の内部リンクを更新する必要があります：
- `../functional/functions/` → `../functional/`
- `./BR-001-auction.md` → `../business/auction.md`

### ⏳ アーカイブへの移動
以下のファイルを`/docs/archive/`に移動：
- `/docs/development/DAILY_VIDEO_CALL_COMPLETE.md`
- `/docs/development/DEVELOPMENT.md`
- `/docs/guides/`配下の完了した作業記録

### ⏳ その他の整理
- `/docs/api/`配下のファイルを`/docs/functional/`に移動
- `/docs/guides/`配下のセットアップ関連を`/docs/setup/`に移動
- `/docs/troubleshooting/`を`/docs/setup/troubleshooting/`に移動
- `/docs/user_guide/`を`/docs/setup/user_guide/`に移動

### ⏳ 旧ファイルの削除
移動完了後、以下のディレクトリを削除：
- `/docs/requirements/`（業務仕様は`/docs/business/`に移動済み）

## 注意事項

- ファイル移動時は、内部リンクの更新が必要
- 既存のREADME.mdファイルは内容を確認してから統合
- アーカイブ移動は削除ではなく移動（履歴保持）

---

**最終更新日**: 2025-01-XX

