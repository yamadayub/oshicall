# Call Status Management テスト計画書

## 概要

`call_slots`テーブルの`status`カラムが通話ライフサイクルに応じて正しく更新されることを検証するためのテスト計画書です。

**対象要求仕様**: [/docs/requirements/call-status-management.md](../requirements/call-status-management.md)

**テスト対象機能**:
- FR-001: `purchased_slots`作成時の`status`更新
- FR-002: 通話終了時の`status`更新
- FR-003: 既存データの整合性確保

## テスト方針

### テストレベル

1. **単体テスト**: 各関数・エンドポイントの個別動作確認
2. **統合テスト**: 複数コンポーネント間の連携確認
3. **E2Eテスト**: 実際のユーザーシナリオに沿ったテスト

### テスト環境

- **ローカル環境**: 開発環境でのテスト
- **ステージング環境**: 本番相当環境でのテスト

### テストデータ

- テスト用ユーザー（ファン、インフルエンサー）
- テスト用Talk枠
- テスト用オークション

## テストケース一覧

### FR-001: purchased_slots作成時のstatus更新

#### TC-001: オークション終了時のstatus更新（正常系）

**テストケース名**: オークション終了時に`call_slots.status`が`'live'`に更新される

**前提条件**:
- インフルエンサーアカウントが存在し、Stripe Connect設定済み
- ファンアカウントが存在し、カード登録済み
- オークション開催中のTalk枠が存在する（`call_slots.status = 'planned'`）
- 入札が1件以上存在する

**テスト手順**:
1. オークション終了時刻を設定（即座に終了するよう調整）
2. オークション終了処理（`finalize-auctions` Edge Function）を実行
3. データベースを確認:
   - `purchased_slots`レコードが作成されている
   - `call_slots.status`が`'live'`に更新されている
   - `call_slots.id`と`purchased_slots.call_slot_id`が一致している

**期待結果**:
- `purchased_slots`レコードが正常に作成される
- `call_slots.status`が`'planned'`から`'live'`に更新される
- 更新日時（`call_slots.updated_at`）が更新される

**テスト種別**: 統合テスト

**優先度**: 高

---

#### TC-002: 即決購入時のstatus更新（正常系）

**テストケース名**: 即決購入時に`call_slots.status`が`'live'`に更新される

**前提条件**:
- インフルエンサーアカウントが存在し、Stripe Connect設定済み
- ファンアカウントが存在し、カード登録済み
- 即決価格が設定されたTalk枠が存在する（`call_slots.status = 'planned'`）

**テスト手順**:
1. ファンアカウントで即決購入（`POST /api/buy-now`）を実行
2. データベースを確認:
   - `purchased_slots`レコードが作成されている
   - `call_slots.status`が`'live'`に更新されている
   - `call_slots.id`と`purchased_slots.call_slot_id`が一致している

**期待結果**:
- `purchased_slots`レコードが正常に作成される
- `call_slots.status`が`'planned'`から`'live'`に更新される
- 更新日時（`call_slots.updated_at`）が更新される

**テスト種別**: 統合テスト

**優先度**: 高

---

#### TC-003: 更新失敗時のエラーハンドリング（異常系）

**テストケース名**: `call_slots.status`更新失敗時も`purchased_slots`作成は成功する

**前提条件**:
- テスト用のTalk枠が存在する
- `call_slots`テーブルへのUPDATE権限を一時的に制限（テスト用）

**テスト手順**:
1. オークション終了処理または即決購入処理を実行
2. `call_slots.status`更新処理でエラーが発生するよう設定
3. 処理結果を確認:
   - `purchased_slots`レコードは正常に作成される
   - エラーログが記録される
   - 処理が継続される（例外で中断されない）

**期待結果**:
- `purchased_slots`レコードは正常に作成される
- `call_slots.status`更新エラーがログに記録される
- アプリケーションがクラッシュしない

**テスト種別**: 統合テスト

**優先度**: 中

---

#### TC-004: 複数オークション同時終了時のstatus更新

**テストケース名**: 複数のオークションが同時に終了しても、それぞれの`call_slots.status`が正しく更新される

**前提条件**:
- 複数のオークション開催中のTalk枠が存在する（各々`call_slots.status = 'planned'`）
- 各オークションに入札が存在する

**テスト手順**:
1. 複数のオークション終了処理を同時に実行
2. データベースを確認:
   - 各`purchased_slots`レコードが作成されている
   - 各`call_slots.status`が`'live'`に更新されている
   - 更新が正しい`call_slot_id`に対して行われている

**期待結果**:
- すべての`call_slots.status`が正しく`'live'`に更新される
- データの不整合が発生しない

**テスト種別**: 統合テスト

**優先度**: 中

---

### FR-002: 通話終了時のstatus更新

#### TC-005: 通話終了時のstatus更新（正常系）

**テストケース名**: 通話終了時に`call_slots.status`が`'completed'`に更新される

**前提条件**:
- `purchased_slots`レコードが存在する（`call_status = 'in_progress'`）
- 対応する`call_slots.status = 'live'`
- Daily.coルームが作成済み

**テスト手順**:
1. 通話終了エンドポイント（`POST /api/calls/end-call`）を呼び出す
2. データベースを確認:
   - `purchased_slots.call_status`が`'completed'`に更新されている
   - `call_slots.status`が`'completed'`に更新されている
   - `call_slots.id`と`purchased_slots.call_slot_id`が一致している

**期待結果**:
- `purchased_slots.call_status`が`'completed'`に更新される
- `call_slots.status`が`'live'`から`'completed'`に更新される
- 更新日時（`call_slots.updated_at`）が更新される

**テスト種別**: 統合テスト

**優先度**: 高

---

#### TC-006: 既に終了済み通話の再終了処理（異常系）

**テストケース名**: 既に`call_status = 'completed'`の通話を再度終了しようとした場合の処理

**前提条件**:
- `purchased_slots`レコードが存在する（`call_status = 'completed'`）
- 対応する`call_slots.status = 'completed'`

**テスト手順**:
1. 通話終了エンドポイント（`POST /api/calls/end-call`）を再度呼び出す
2. データベースを確認:
   - `purchased_slots.call_status`が`'completed'`のまま
   - `call_slots.status`が`'completed'`のまま（重複更新されない）

**期待結果**:
- 既存の`completed`ステータスが維持される
- 重複更新が発生しない
- 適切なレスポンスが返される（既に終了済みの旨）

**テスト種別**: 統合テスト

**優先度**: 中

---

#### TC-007: 更新失敗時のエラーハンドリング（異常系）

**テストケース名**: `call_slots.status`更新失敗時も`purchased_slots`更新は成功する

**前提条件**:
- `purchased_slots`レコードが存在する
- `call_slots`テーブルへのUPDATE権限を一時的に制限（テスト用）

**テスト手順**:
1. 通話終了エンドポイント（`POST /api/calls/end-call`）を呼び出す
2. `call_slots.status`更新処理でエラーが発生するよう設定
3. 処理結果を確認:
   - `purchased_slots.call_status`は`'completed'`に更新される
   - エラーログが記録される
   - 処理が継続される（例外で中断されない）

**期待結果**:
- `purchased_slots.call_status`は正常に`'completed'`に更新される
- `call_slots.status`更新エラーがログに記録される
- アプリケーションがクラッシュしない

**テスト種別**: 統合テスト

**優先度**: 中

---

### FR-003: 既存データの整合性確保

#### TC-008: マイグレーションスクリプト実行（正常系）

**テストケース名**: 既存データの整合性を確保するマイグレーションスクリプトが正しく動作する

**前提条件**:
- 既存の`call_slots`レコードが存在する（`status = 'planned'`）
- 一部の`call_slots`に対応する`purchased_slots`が存在する
  - `call_status = 'completed'`のもの
  - `call_status = 'in_progress'`のもの
  - `call_status = 'pending'`のもの

**テスト手順**:
1. マイグレーションスクリプトを実行
2. データベースを確認:
   - `purchased_slots.call_status = 'completed'`の場合、`call_slots.status = 'completed'`に更新されている
   - `purchased_slots.call_status != 'completed'`の場合、`call_slots.status = 'live'`に更新されている
   - `purchased_slots`が存在しない`call_slots`は`status = 'planned'`のまま

**期待結果**:
- すべての`call_slots.status`が適切に更新される
- 更新対象外のレコードは変更されない
- エラーが発生しない

**テスト種別**: 統合テスト

**優先度**: 中

---

#### TC-009: マイグレーションスクリプトの冪等性

**テストケース名**: マイグレーションスクリプトを複数回実行しても問題が発生しない

**前提条件**:
- マイグレーションスクリプトが1回実行済み

**テスト手順**:
1. マイグレーションスクリプトを再度実行
2. データベースを確認:
   - データが正しく維持されている
   - 重複更新が発生していない
   - エラーが発生しない

**期待結果**:
- スクリプトが正常に完了する
- データが不整合にならない
- 既に正しい状態のレコードは変更されない

**テスト種別**: 統合テスト

**優先度**: 低

---

## E2Eテストシナリオ

### E2E-001: 完全な通話ライフサイクルテスト

**テストケース名**: オークション落札から通話終了まで、`call_slots.status`が正しく遷移する

**前提条件**:
- インフルエンサーアカウントが存在し、Stripe Connect設定済み
- ファンアカウントが存在し、カード登録済み

**テスト手順**:
1. インフルエンサーがTalk枠を作成（`call_slots.status = 'planned'`）
2. オークションを開始
3. ファンが入札
4. オークション終了（自動落札）
5. **検証**: `call_slots.status`が`'live'`に更新されている
6. 通話を開始（`purchased_slots.call_status = 'in_progress'`）
7. 通話を終了（`POST /api/calls/end-call`）
8. **検証**: `call_slots.status`が`'completed'`に更新されている

**期待結果**:
- `call_slots.status`が`planned` → `live` → `completed`と正しく遷移する
- 各遷移タイミングでデータが正しく更新される

**テスト種別**: E2Eテスト

**優先度**: 高

---

### E2E-002: 即決購入フローの完全テスト

**テストケース名**: 即決購入から通話終了まで、`call_slots.status`が正しく遷移する

**前提条件**:
- インフルエンサーアカウントが存在し、Stripe Connect設定済み
- ファンアカウントが存在し、カード登録済み
- 即決価格が設定されたTalk枠が存在する

**テスト手順**:
1. インフルエンサーがTalk枠を作成（`call_slots.status = 'planned'`）
2. オークションを開始（即決価格設定済み）
3. ファンが即決購入（`POST /api/buy-now`）
4. **検証**: `call_slots.status`が`'live'`に更新されている
5. 通話を開始
6. 通話を終了
7. **検証**: `call_slots.status`が`'completed'`に更新されている

**期待結果**:
- `call_slots.status`が`planned` → `live` → `completed`と正しく遷移する
- 各遷移タイミングでデータが正しく更新される

**テスト種別**: E2Eテスト

**優先度**: 高

---

## パフォーマンステスト

### PT-001: status更新処理のレスポンスタイム

**テストケース名**: `call_slots.status`更新処理が500ms以内に完了する

**前提条件**:
- 通常のテスト環境

**テスト手順**:
1. `purchased_slots`作成処理を実行
2. `call_slots.status`更新処理の実行時間を測定
3. 10回実行して平均を算出

**期待結果**:
- 更新処理が500ms以内に完了する（NFR-001）

**テスト種別**: パフォーマンステスト

**優先度**: 低

---

### PT-002: 一括更新処理のパフォーマンス

**テストケース名**: 既存データの一括更新が適切な時間で完了する

**前提条件**:
- 100件以上の`call_slots`レコードが存在する
- そのうち50%以上に`purchased_slots`が存在する

**テスト手順**:
1. マイグレーションスクリプトを実行
2. 実行時間を測定
3. データベース負荷を監視

**期待結果**:
- 一括更新が適切な時間（10秒以内想定）で完了する
- データベース負荷が許容範囲内である

**テスト種別**: パフォーマンステスト

**優先度**: 低

---

## データ整合性テスト

### DI-001: statusとcall_statusの整合性確認

**テストケース名**: `call_slots.status`と`purchased_slots.call_status`の整合性が保たれる

**前提条件**:
- 複数の`call_slots`と`purchased_slots`が存在する

**テスト手順**:
1. すべての`call_slots`と対応する`purchased_slots`を取得
2. 整合性を確認:
   - `purchased_slots`が存在する場合、`call_slots.status`は`'live'`または`'completed'`
   - `purchased_slots.call_status = 'completed'`の場合、`call_slots.status = 'completed'`
   - `purchased_slots.call_status != 'completed'`かつ`purchased_slots`が存在する場合、`call_slots.status = 'live'`

**期待結果**:
- すべてのレコードで整合性が保たれている

**テスト種別**: データ整合性テスト

**優先度**: 高

---

## テスト実行チェックリスト

### 準備

- [ ] テスト環境がセットアップ済み
- [ ] テストデータが準備済み
- [ ] テスト用アカウントが作成済み
- [ ] データベースバックアップが取得済み

### FR-001テスト

- [ ] TC-001: オークション終了時のstatus更新（正常系）
- [ ] TC-002: 即決購入時のstatus更新（正常系）
- [ ] TC-003: 更新失敗時のエラーハンドリング（異常系）
- [ ] TC-004: 複数オークション同時終了時のstatus更新

### FR-002テスト

- [ ] TC-005: 通話終了時のstatus更新（正常系）
- [ ] TC-006: 既に終了済み通話の再終了処理（異常系）
- [ ] TC-007: 更新失敗時のエラーハンドリング（異常系）

### FR-003テスト

- [ ] TC-008: マイグレーションスクリプト実行（正常系）
- [ ] TC-009: マイグレーションスクリプトの冪等性

### E2Eテスト

- [ ] E2E-001: 完全な通話ライフサイクルテスト
- [ ] E2E-002: 即決購入フローの完全テスト

### パフォーマンステスト

- [ ] PT-001: status更新処理のレスポンスタイム
- [ ] PT-002: 一括更新処理のパフォーマンス

### データ整合性テスト

- [ ] DI-001: statusとcall_statusの整合性確認

## テスト結果記録

### テスト実行日時
- 実行日: YYYY-MM-DD
- 実行者: [名前]
- 環境: [ローカル/ステージング]

### テスト結果サマリー

| テストケースID | テストケース名 | 結果 | 備考 |
|---------------|--------------|------|------|
| TC-001 | オークション終了時のstatus更新（正常系） | ✅/❌ | |
| TC-002 | 即決購入時のstatus更新（正常系） | ✅/❌ | |
| ... | ... | ... | ... |

### 発見された問題

#### 問題1: [タイトル]
- **発生条件**: 
- **再現手順**: 
- **期待結果**: 
- **実際の結果**: 
- **優先度**: 高/中/低
- **ステータス**: 新規/修正中/修正済み

## 関連ドキュメント

- [要求仕様ドキュメント](../requirements/call-status-management.md)
- [E2Eテストガイド](./E2E_TEST_GUIDE.md)
- [ステージング環境テストガイド](./STAGING_E2E_TEST_GUIDE.md)

## 変更履歴

| 日付 | 変更内容 | 理由 |
|------|----------|------|
| 2025-01-XX | 初回作成 | call_slotsステータス更新機能のテスト計画作成 |
