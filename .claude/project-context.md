# OshiTalk プロジェクト設定

## 📋 プロジェクト概要

**プロジェクト名**: OshiTalk（おしトーク）

**概要**: インフルエンサーと1対1でビデオ通話できる時間をオークション形式で購入できるサービス

**主な機能**:
- オークション形式でのTalk枠販売
- 1対1ビデオ通話（Daily.co）
- Stripe決済（2段階: Authorization → Capture）
- 高度な決済フロー（Talk完了後に決済確定）
- フォロー機能
- 通知機能（Resend）

## 🏗️ 技術スタック

### フロントエンド
- **React** 18 + TypeScript
- **Vite** (ビルドツール)
- **TailwindCSS** (スタイリング)
- **React Router** (ルーティング)
- **Lucide React** (アイコン)

### バックエンド
- **Node.js** / Express + TypeScript
- **Supabase** (PostgreSQL, Auth, Storage)
- **Stripe API** (決済、Connect)
- **Daily.co API** (ビデオ通話)
- **Resend** (メール送信)

### インフラ
- **Heroku** (本番・Staging環境)
- **Cloudflare** (DNS管理、CDN)
- **Supabase Cloud** (DB、認証)

## 🌐 環境構成

### Production
- **URL**: https://oshi-talk.com
- **Heroku App**: oshicall-production
- **Supabase Project**: atkhwwqunwmpzqkgavtx (Tokyo)
- **Stripe**: Live mode
- **Daily.co Webhook**: Active (e2f06847-84b4-4a06-b859-9b0993b321da)

### Staging
- **URL**: https://staging.oshi-talk.com
- **Heroku App**: oshicall-staging
- **Supabase Project**: wioealhsienyubwegvdu (Tokyo)
- **Stripe**: Test mode

## 📁 ディレクトリ構造

```
oshicall/
├── backend/                    # バックエンド（Express + TypeScript）
│   └── src/
│       ├── server.ts          # メインサーバー（重要）
│       ├── routes/            # APIルート
│       │   ├── stripe.ts      # Stripe決済API
│       │   └── dailyWebhook.ts # Daily.co Webhook
│       └── services/          # ビジネスロジック
│           └── paymentCapture.ts # 決済判定ロジック（重要）
├── src/                        # フロントエンド（React）
│   ├── pages/                 # ページコンポーネント
│   │   ├── Home.tsx          # ホーム（Talk枠一覧）
│   │   ├── TalkDetail.tsx    # Talk詳細・入札
│   │   └── LiveTalk.tsx      # ビデオ通話
│   ├── components/           # 再利用可能コンポーネント
│   ├── contexts/             # Reactコンテキスト
│   └── lib/                  # ライブラリ設定
├── supabase/
│   ├── migrations/           # DBマイグレーション
│   │   └── 20251113000000_initial_schema.sql
│   └── functions/            # Edge Functions
│       └── notify-new-talk-slot/ # Talk枠通知
├── docs/                      # ドキュメント（重要）
│   ├── README.md             # ドキュメント一覧
│   ├── deployment/           # デプロイ関連
│   │   └── PRODUCTION_SETUP.md
│   ├── functional/           # 機能仕様
│   │   ├── ADVANCED_PAYMENT_FLOW.md # 高度な決済フロー
│   │   └── functions/
│   │       └── payment.md
│   └── setup/                # セットアップガイド
│       ├── DATABASE_MIGRATIONS.md
│       └── RESEND_EMAIL_SETUP.md
└── .claude/                   # Claude Code設定（このファイル）
```

## 🔑 重要な環境変数

### Heroku（Production）
```bash
SUPABASE_URL=https://atkhwwqunwmpzqkgavtx.supabase.co
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_kPYFFL7KmE0u3hhVHkpyz0VidHWcddDr
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_jnK8EWONJkF2TaCvu4tqr4QlqP3Jp1ba
DAILY_API_KEY=bbc2e4684848f2b4b0c5352fa96a3d9495277abf63be6112974ddc2fc1d38e4b
FRONTEND_URL=https://oshi-talk.com
NODE_ENV=production
```

### Supabase Edge Functions（Production）
```bash
RESEND_API_KEY=re_...
FROM_EMAIL=OshiTalk <noreply@oshi-talk.com>
APP_URL=https://oshi-talk.com
```

## 📊 データベース主要テーブル

| テーブル名 | 説明 | 重要度 |
|-----------|------|--------|
| `users` | ユーザー情報（fan/influencer） | ⭐⭐⭐ |
| `call_slots` | Talk枠 | ⭐⭐⭐ |
| `auctions` | オークション | ⭐⭐⭐ |
| `bids` | 入札履歴 | ⭐⭐⭐ |
| `purchased_slots` | 購入済みTalk枠 | ⭐⭐⭐ |
| `daily_call_events` | Daily.co イベントログ | ⭐⭐ |
| `payment_transactions` | 決済履歴 | ⭐⭐ |
| `follows` | フォロー関係 | ⭐⭐ |

## 🎯 重要な実装パターン

### 1. 高度な決済フロー（Webhook活用）

**フロー**:
```
1. オークション終了 → purchased_slots作成（status='pending'）
2. Talk実施 → Daily.co Webhookでイベント記録
3. room.ended受信 → 決済判定（paymentCapture.ts）
4. 条件を満たす → Capture（決済確定）
   条件を満たさない → Cancel（与信解放）
```

**判定条件（すべて満たす必要あり）**:
1. ✅ インフルエンサーが参加した
2. ✅ ルームが「規定時間経過による自動終了」になった
3. ✅ インフルエンサーが途中退出していない

**実装ファイル**:
- `backend/src/server.ts:1050-1177` - オークション終了処理
- `backend/src/routes/dailyWebhook.ts` - Webhook受信
- `backend/src/services/paymentCapture.ts` - 決済判定ロジック

**詳細**: `docs/functional/ADVANCED_PAYMENT_FLOW.md`

### 2. Stripe 2段階決済

**Authorization（与信確保）**: 入札時
```typescript
const paymentIntent = await stripe.paymentIntents.create({
  amount: amount,
  currency: 'jpy',
  customer: customerId,
  capture_method: 'manual', // 重要！
  // ...
});
```

**Capture（決済確定）**: Talk完了後
```typescript
const capturedPayment = await stripe.paymentIntents.capture(paymentIntentId);
```

**Cancel（与信解放）**: 落札できなかった場合 or Talk未完了
```typescript
await stripe.paymentIntents.cancel(paymentIntentId);
```

### 3. メール送信（Resend）

**送信元**: `OshiTalk <noreply@oshi-talk.com>`
**返信先**: `info@oshi-talk.com`
**送信先**: ユーザーの登録メールアドレス（任意のアドレスに送信可能）

**実装ファイル**: `supabase/functions/notify-new-talk-slot/index.ts`

## 🛠️ よく使うコマンド

### 開発
```bash
# ローカル開発サーバー起動
npm run dev

# バックエンド起動（開発）
npm run server:dev

# ビルド
npm run build
```

### デプロイ
```bash
# Productionデプロイ
git push heroku main
# または
git push production main

# Stagingデプロイ
git push staging main
```

### Supabase
```bash
# マイグレーション適用（Production）
SUPABASE_ACCESS_TOKEN="sbp_..." npx supabase db push \
  --db-url "postgresql://postgres.atkhwwqunwmpzqkgavtx:$SUPABASE_DB_PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"

# Secrets確認（Production）
SUPABASE_ACCESS_TOKEN="sbp_..." npx supabase secrets list \
  --project-ref atkhwwqunwmpzqkgavtx

# Edge Function デプロイ
SUPABASE_ACCESS_TOKEN="sbp_..." npx supabase functions deploy \
  --project-ref atkhwwqunwmpzqkgavtx
```

### Heroku
```bash
# ログ確認
heroku logs --tail --app oshicall-production

# 環境変数確認
heroku config --app oshicall-production

# アプリ再起動
heroku restart --app oshicall-production
```

## 📝 コーディング規約

### TypeScript
- すべての関数に型定義を付ける
- `any`型は極力避ける
- エラーハンドリングは必須

### React
- Functional ComponentsとHooksを使用
- propsは明確な型定義を持つ
- useEffectの依存配列は正確に設定

### ファイル命名
- コンポーネント: PascalCase (例: `TalkCard.tsx`)
- ユーティリティ: camelCase (例: `formatPrice.ts`)
- 型定義: `types.ts` または `types/`

### コミットメッセージ
```
feat: 新機能追加
fix: バグ修正
docs: ドキュメント更新
refactor: リファクタリング
test: テスト追加・修正
chore: ビルド・設定変更
```

**フォーマット**:
```
<type>: <短い説明>

<詳細な説明（オプション）>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## 🚨 注意事項

### セキュリティ
- **絶対にコミットしてはいけない**: APIキー、Secret、パスワード
- 環境変数は必ず`.env`ファイル（gitignore済み）に記載
- Production APIキーは本番環境でのみ使用

### Stripe
- Test modeとLive modeを明確に区別
- Webhookは2種類必要（プラットフォーム + Connect）
- Payment Intentは必ず`capture_method: 'manual'`

### Daily.co
- Webhook URLは本番環境のみ設定（`https://oshi-talk.com/api/daily/webhook`）
- room.endedイベントの`room_end_reason`を必ず確認
  - `duration`: 規定時間で自動終了（課金OK）
  - `manual`: 手動終了（課金NG）

### データベース
- マイグレーションは必ずバージョン管理
- 本番DBへの直接変更は厳禁
- ローカル → Staging → Production の順で適用

## 📚 主要ドキュメント

| ドキュメント | 用途 |
|-------------|------|
| `docs/README.md` | ドキュメント一覧 |
| `docs/deployment/PRODUCTION_SETUP.md` | Production環境セットアップ |
| `docs/functional/ADVANCED_PAYMENT_FLOW.md` | 高度な決済フロー |
| `docs/functional/functions/payment.md` | 決済機能仕様 |
| `docs/setup/DATABASE_MIGRATIONS.md` | DBマイグレーション管理 |
| `docs/setup/RESEND_EMAIL_SETUP.md` | メール送信設定 |

## 🔗 外部サービスリンク

- **Heroku Production**: https://dashboard.heroku.com/apps/oshicall-production
- **Heroku Staging**: https://dashboard.heroku.com/apps/oshicall-staging
- **Supabase Production**: https://supabase.com/dashboard/project/atkhwwqunwmpzqkgavtx
- **Supabase Staging**: https://supabase.com/dashboard/project/wioealhsienyubwegvdu
- **Stripe Dashboard**: https://dashboard.stripe.com/
- **Daily.co Dashboard**: https://dashboard.daily.co/
- **Resend Dashboard**: https://resend.com/
- **Cloudflare DNS**: https://dash.cloudflare.com/

## 💡 作業時のヒント

### ドキュメントを必ず参照する
- 新機能実装前に関連ドキュメントを確認
- 変更があればドキュメントも更新

### エラーが出たら
1. コンソールログを確認（ブラウザ・サーバー）
2. Herokuログを確認（`heroku logs --tail`）
3. Supabase Logsを確認
4. 関連ドキュメントを確認

### デプロイ前のチェック
- [ ] ローカルでビルドが通る（`npm run build`）
- [ ] 環境変数が正しく設定されている
- [ ] マイグレーションが適用されている
- [ ] ドキュメントが更新されている

### コードレビュー時
- [ ] 要件定義との整合性
- [ ] データ構造の変更有無
- [ ] セキュリティ対策の実装
- [ ] エラーハンドリングの実装

---

**最終更新**: 2025-11-22
**バージョン**: 1.0.0
