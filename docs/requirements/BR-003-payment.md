# BR-003: 決済・カード登録機能

## 概要

Stripe APIを使用した安全な決済処理システム。オークション入札時に与信確保（Authorization）を行い、Talk完了後に決済確定（Capture）する2段階決済により、ファンとインフルエンサーの両方にとって公平な決済を実現します。

**ビジネス価値**:
- ファンはTalk完了後のみ課金され、不公平な決済を回避できる
- インフルエンサーはサービス提供後に確実に収益を得られる
- プラットフォームはPCI DSS準拠の安全な決済システムを提供

## ユーザーストーリー

### US-001: カード情報登録（ファン視点）
```
As a ファン,
I want to カード情報を安全に登録する,
So that オークションに入札できる
```

### US-002: 入札時の与信確保（ファン視点）
```
As a ファン,
I want to 入札時点では課金されない,
So that 落札できなかった場合に無駄な決済が発生しない
```

### US-003: Talk完了後の決済確定（ファン視点）
```
As a ファン,
I want to Talkが正常完了した場合のみ課金される,
So that インフルエンサーが不在でも課金されることがない
```

### US-004: Talk不成立時の与信解放（ファン視点）
```
As a ファン,
I want to Talkが成立しなかった場合に与信が解放される,
So that カードの利用可能額が適切に戻る
```

### US-005: 売上確認（インフルエンサー視点）
```
As a インフルエンサー,
I want to 完了したTalkの売上を確認する,
So that 収益状況を把握できる
```

## 機能要件

### FR-001: Stripe顧客作成
**説明**: 初回カード登録時にStripe顧客アカウントを作成

**受け入れ条件**:
- [ ] ユーザー登録時に自動的にStripe顧客が作成される
- [ ] `stripe_customer_id` が `users` テーブルに保存される
- [ ] ユーザー名・メールアドレスがStripeに同期される
- [ ] 顧客作成失敗時にエラーメッセージが表示される
- [ ] リトライ機能が動作する（最大3回）

**関連ファイル**:
- 実装: `backend/src/server.ts` (POST /api/stripe/create-customer)
- 技術仕様: [/docs/functional/functions/payment.md#1-stripe顧客作成](../functional/functions/payment.md)

---

### FR-002: カード情報登録
**説明**: ファンがStripe Elementsを使用してカード情報を安全に登録

**受け入れ条件**:
- [ ] カード登録モーダルが表示される
- [ ] Stripe Elementsでカード番号・有効期限・CVCを入力できる
- [ ] 入力値のリアルタイムバリデーションが機能する
- [ ] カード情報はStripe経由で送信される（自社サーバーに保存されない）
- [ ] PaymentMethodが作成される
- [ ] PaymentMethodが顧客にアタッチされる
- [ ] デフォルト支払い方法として設定される
- [ ] `users.has_payment_method` が `true` に更新される
- [ ] 登録成功時に確認メッセージが表示される

**関連ファイル**:
- 実装: `src/components/CardRegistrationModal.tsx`
- バックエンド: `backend/src/server.ts` (POST /api/stripe/attach-payment-method)
- 技術仕様: [/docs/functional/functions/payment.md#2-カード情報登録](../functional/functions/payment.md)

---

### FR-003: 与信確保（Authorization）
**説明**: 入札時または即決購入時にカードの与信を確保

**受け入れ条件**:
- [ ] 入札額に対してPayment Intentが作成される
- [ ] `capture_method: 'manual'` が設定される（自動決済を防ぐ）
- [ ] 顧客のデフォルト支払い方法が使用される
- [ ] カードの有効性が確認される
- [ ] 利用可能額が確認される
- [ ] 与信確保成功時に `paymentIntentId` が返却される
- [ ] `bids` テーブルに `stripe_payment_intent_id` が保存される
- [ ] 与信確保失敗時にエラーメッセージが表示される

**与信確保の意味**:
- カードの有効性確認
- 利用可能額の確認
- 金額を一時的に「保留」（実際の引き落としはまだ）
- 最大7日間保持可能

**関連ファイル**:
- 実装: `backend/src/server.ts` (POST /api/stripe/authorize-payment)
- 技術仕様: [/docs/functional/functions/payment.md#3-与信確保](../functional/functions/payment.md)

---

### FR-004: 決済確定（Capture）
**説明**: Talk正常完了後に与信を確定し、実際に決済を実行

**受け入れ条件**:
- [ ] Talk完了判定がすべての条件を満たす場合のみ実行される
- [ ] Payment Intent Capture APIが呼び出される
- [ ] Capture成功時に `payment_transactions` レコードが作成される
- [ ] `purchased_slots.call_status` が `completed` に更新される
- [ ] ユーザー統計（total_calls_completed, total_earned）が更新される
- [ ] Capture失敗時にリトライが実行される（最大3回）
- [ ] リトライ失敗時にエラーログが記録される

**関連ファイル**:
- 実装: `backend/src/services/paymentCapture.ts` (captureTalkPayment関数)
- 技術仕様: [/docs/functional/functions/payment.md#4-決済確定](../functional/functions/payment.md)
- 詳細フロー: [/docs/functional/ADVANCED_PAYMENT_FLOW.md#ケースa-すべての条件を満たした場合](../functional/ADVANCED_PAYMENT_FLOW.md)

---

### FR-005: 与信解放（Cancel）
**説明**: Talk不成立時またはオークション落札失敗時に与信を解放

**受け入れ条件**:
- [ ] オークション終了時、落札できなかった入札の与信が解放される
- [ ] Talk不成立時（インフルエンサーno-show等）に与信が解放される
- [ ] Payment Intent Cancel APIが呼び出される
- [ ] Cancel成功時にファンのカード利用可能額が戻る
- [ ] `purchased_slots.call_status` が `cancelled` に更新される
- [ ] Cancel失敗時にエラーログが記録される

**与信解放のケース**:
- オークション落札失敗
- インフルエンサーがno-show（不参加）
- インフルエンサーが途中退出
- 規定時間前に手動終了

**関連ファイル**:
- 実装: `backend/src/services/paymentCapture.ts`
- バックエンド: `backend/src/server.ts` (POST /api/stripe/cancel-payment)
- 技術仕様: [/docs/functional/functions/payment.md#5-与信解放](../functional/functions/payment.md)
- 詳細フロー: [/docs/functional/ADVANCED_PAYMENT_FLOW.md#ケースb-条件を満たさない場合](../functional/ADVANCED_PAYMENT_FLOW.md)

---

### FR-006: Talk完了後の決済判定
**説明**: Daily.co Webhookイベントを分析し、決済確定または与信解放を判定

**受け入れ条件**:
- [ ] `room.ended` または `meeting.ended` イベント受信時にトリガーされる
- [ ] インフルエンサー参加有無を確認できる
- [ ] ルーム終了理由（duration/manual）を判定できる
- [ ] インフルエンサー途中退出有無を判定できる
- [ ] すべての条件を満たす場合、決済確定処理を実行する
- [ ] 条件を満たさない場合、与信解放処理を実行する
- [ ] 判定ロジックが非同期で実行される（Webhook即座にレスポンス）

**判定条件（すべて満たす必要あり）**:
1. インフルエンサーが参加した
2. ルームが規定時間経過で自動終了した (`room_end_reason: 'duration'`)
3. インフルエンサーが途中退出していない

**関連ファイル**:
- 実装: `backend/src/services/paymentCapture.ts` (shouldCaptureTalkPayment関数)
- Webhook: `backend/src/routes/dailyWebhook.ts`
- 技術仕様: [/docs/functional/ADVANCED_PAYMENT_FLOW.md#3-決済判定ロジック](../functional/ADVANCED_PAYMENT_FLOW.md)

---

### FR-007: 決済履歴管理
**説明**: 決済トランザクションをデータベースに記録・管理

**受け入れ条件**:
- [ ] 決済確定時に `payment_transactions` レコードが作成される
- [ ] `stripe_payment_intent_id` が記録される
- [ ] `stripe_charge_id` が記録される
- [ ] 金額（amount）が記録される
- [ ] プラットフォーム手数料（platform_fee）が記録される
- [ ] インフルエンサー配分（influencer_payout）が記録される
- [ ] ステータス（captured/cancelled）が記録される
- [ ] トランザクション作成日時が記録される

**関連ファイル**:
- データベース: `payment_transactions` テーブル
- 技術仕様: [/docs/functional/functions/payment.md#データ構造](../functional/functions/payment.md)

---

### FR-008: カード情報更新・削除
**説明**: ファンが登録済みカード情報を更新または削除できる（将来実装）

**受け入れ条件**:
- [ ] マイページでカード情報を確認できる
- [ ] カード番号の下4桁とブランドが表示される
- [ ] 「カードを変更」ボタンが機能する
- [ ] 新しいカードを登録できる
- [ ] 古いカードが自動的に削除される
- [ ] 「カードを削除」ボタンが機能する
- [ ] カード削除後は入札不可になる

**関連ファイル**:
- 実装: 将来実装予定
- 技術仕様: [/docs/functional/functions/payment.md](../functional/functions/payment.md)

## 非機能要件

### セキュリティ
- **NFR-001**: カード情報は自社サーバーに保存されない（PCI DSS準拠）
- **NFR-002**: Stripe Elementsを使用してカード情報を送信する
- **NFR-003**: Payment Intent IDのみをデータベースに保存する
- **NFR-004**: Stripe Secret Keyは環境変数で管理される
- **NFR-005**: すべての決済関連通信はHTTPSで行われる
- **NFR-006**: Stripe Webhook署名を検証する（将来実装）

### パフォーマンス
- **NFR-007**: カード登録処理は5秒以内に完了する
- **NFR-008**: 与信確保処理は3秒以内に完了する
- **NFR-009**: 決済確定処理は5秒以内に完了する
- **NFR-010**: Webhook処理は1秒以内にレスポンスを返す

### 信頼性
- **NFR-011**: 決済確定失敗時は自動リトライが実行される（最大3回）
- **NFR-012**: 与信解放失敗時はエラーログが記録される
- **NFR-013**: Payment Intent作成失敗時はロールバックされる
- **NFR-014**: すべての決済処理はトランザクション内で実行される

### ユーザビリティ
- **NFR-015**: カード登録フォームは入力しやすいデザインである
- **NFR-016**: エラーメッセージは具体的でわかりやすい
- **NFR-017**: 決済タイミングの説明が明確に表示される
- **NFR-018**: セキュリティ説明（「カード情報は安全に保護されます」）が表示される

## ビジネスルール

### BR-001: 決済タイミング
- 入札時: 与信確保のみ（Authorization）
- Talk完了後: 決済確定（Capture）
- Talk不成立: 与信解放（Cancel）

### BR-002: 与信有効期限
- Stripe Payment Intentの与信は最大7日間有効
- 7日以内にTalkを完了する必要がある
- 7日経過後は自動的に与信が解放される

### BR-003: プラットフォーム手数料
- 現在: 手数料率は未設定（将来実装）
- 将来: 決済額の一定割合（例: 10%）をプラットフォーム手数料として徴収

### BR-004: カード登録制限
- 1ユーザーにつき1枚のカードのみ登録可能（現在）
- カード登録なしでは入札不可

### BR-005: テストカード
- Staging環境ではStripeテストカードのみ使用可能
- 成功カード: `4242 4242 4242 4242`
- 失敗カード: `4000 0000 0000 0002`（カード拒否）

## エラーケース一覧

### ケース1: インフルエンサーno-show
- イベント: インフルエンサー不参加
- 判定結果: `influencer_no_show`
- 処理: 与信解放（Cancel）
- ファンへの影響: 課金なし

### ケース2: インフルエンサー途中退出
- イベント: インフルエンサーが規定時間前に退出
- 判定結果: `influencer_left_early`
- 処理: 与信解放（Cancel）
- ファンへの影響: 課金なし

### ケース3: 手動早期終了
- イベント: 規定時間前に手動で終了ボタンを押す
- 判定結果: `room_not_ended_by_duration`
- 処理: 与信解放（Cancel）
- ファンへの影響: 課金なし

### ケース4: 正常完了
- イベント: 規定時間まで通話実施
- 判定結果: `completed_successfully`
- 処理: 決済確定（Capture）
- ファンへの影響: 課金確定

## 関連する他の要件

- [BR-001: オークション機能](./BR-001-auction.md) - 入札時の与信確保
- [BR-002: Talk機能](./BR-002-talk.md) - Talk完了後の決済確定
- [BR-004: 認証機能](./BR-004-authentication.md) - ユーザー認証とStripe顧客紐付け

## 変更履歴

| 日付 | 変更内容 | 理由 |
|------|----------|------|
| 2025-12-10 | 初回作成 | 業務要件ドキュメントの整備 |

## 備考

### 将来実装予定
- プラットフォーム手数料の設定・徴収
- インフルエンサーへの自動振込（Stripe Connect Payout）
- 返金処理（一部返金・全額返金）
- 決済履歴エクスポート（CSV出力）
- カード複数枚登録対応
- 3Dセキュア対応（追加認証）

### 既知の制約
- 与信確保は最大7日間のみ有効（Stripe制限）
- 決済通貨は日本円（JPY）のみ
- Stripeテストモードではリアルな決済は発生しない
- プラットフォーム手数料は現在未実装

### 技術的詳細
詳細な決済フローとWebhook活用については、[高度な決済フロードキュメント](../functional/ADVANCED_PAYMENT_FLOW.md) を参照してください。
