# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**OshiTalk (推しトーク)** - A platform connecting fans with influencers through online video calls. Fans bid in auctions to win exclusive talk sessions with their favorite influencers.

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js (TypeScript) serving both API and static files
- **Database**: Supabase (PostgreSQL)
- **Payment**: Stripe (with Connect for influencer payouts)
- **Video**: Daily.co for live video calls
- **Email**: Resend for notifications
- **Deployment**: Heroku (Production & Staging)

# 開発ワークフロー

## 要件ドキュメント管理

### ディレクトリ構造

```
/docs/requirements/
├── index.md           # 要件一覧・目次
├── auction.md         # オークション機能
├── video-call.md      # ビデオ通話機能
├── payment.md         # 決済機能
└── ...
```

### 変更フロー判定

#### Q: この変更は業務要件の変更を伴うか？

**YES（新機能・仕様変更）の場合:**

```
1. 該当する /docs/requirements/*.md の変更案を提示
2. 要件ドキュメントの承認を得る
3. コード修正方針を提案
4. コード修正の承認を得る
5. 実装
```

**NO（バグ修正・リファクタリング）の場合:**

```
1. 問題の原因と修正方針を提案
2. 承認を得る
3. 実装（要件ドキュメントは変更しない）
```

### 判定基準

| 種別             | 要件 Doc 更新 | 例                         |
| ---------------- | ------------- | -------------------------- |
| 新機能追加       | ✅ 必要       | 新しい入札方式の追加       |
| 仕様変更         | ✅ 必要       | オークション終了時間の変更 |
| バグ修正         | ❌ 不要       | 入札が保存されない問題     |
| リファクタリング | ❌ 不要       | コード整理・最適化         |
| UI 調整          | 状況による    | UX の大幅変更なら必要      |

### 提案フォーマット

#### 要件変更を伴う場合

```
【変更提案】
■ 種別: 新機能 / 仕様変更
■ 対象要件Doc: /docs/requirements/xxx.md

■ 要件の変更内容:
  [変更前] ...
  [変更後] ...

■ コード変更（要件承認後に詳細化）:
  - 影響ファイル概要

→ 要件の変更を承認しますか？
```

#### バグ修正の場合

```
【バグ修正提案】
■ 問題: ...
■ 原因: ...
■ 修正方針: ...
■ 影響ファイル: ...
■ 要件Doc: 変更なし（既存要件を満たすための修正）

→ 修正方針を承認しますか？
```

# 開発ルール

## Proposal-First Protocol

すべてのコード変更は以下のフローに従う：

### Phase 1: 分析（自動実行）

- 現状のコード構造を確認
- 影響範囲を特定

### Phase 2: 提案（承認待ち）

## 提案フォーマット：

【変更提案】
■ 目的:
■ 変更ファイル:
■ 変更内容:
■ 影響範囲:
■ リスク:

---

### Phase 3: 実装（承認後のみ）

「承認」「OK」「やって」のいずれかを受け取るまで実装しない

```

---

## 2. プロンプトの書き方

毎回の指示に以下のような前置きを含めると効果的です：
```

【指示】〇〇の機能を追加したい

【プロセス】

1. まず修正方針と影響範囲を提案してください
2. 私が承認するまでコードは変更しないでください
3. 承認後、1 ファイルずつ変更を進めてください

```

または短縮版：
```

〇〇を実装したい。まず計画だけ提示して、コードは触らないで。

```

---

## 3. 私が効果的だと感じるワークフロー
```

You: 「ログイン機能にエラーハンドリングを追加したい。まず計画を提案して」

AI: 【変更提案】 - auth.ts: try-catch の追加 - login.tsx: エラーメッセージ表示の追加
影響範囲: 認証フロー全体

You: 「auth.ts の変更だけ承認。login.tsx は保留」

AI: （auth.ts のみ変更）

You: 「OK、次に login.tsx も進めて」

## Development Commands

### Frontend Development

```bash
# Install dependencies
npm install

# Start development server (port 5173)
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Preview production build
npm preview
```

### Backend Development

```bash
# Start backend dev server (port 3001) with hot reload
npm run dev:server

# Build backend only
cd backend && npm run build

# Start production backend (port 3001 or PORT env)
npm start
```

### Database Migrations

**IMPORTANT**: Always use `SUPABASE_ACCESS_TOKEN` prefix for Supabase CLI commands.

```bash
# Access token
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6"

# Link to Staging environment
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase link --project-ref wioealhsienyubwegvdu

# Link to Production environment
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase link --project-ref atkhwwqunwmpzqkgavtx

# Create new migration
npx supabase migration new feature_name

# Apply migrations to linked environment
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase db push --linked

# List migrations status
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase migration list --linked

# Generate diff from remote changes
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase db diff --linked --schema public
```

**Migration Workflow**:

1. Create and test in Staging (`wioealhsienyubwegvdu`)
2. Commit migration file to Git
3. Apply to Production (`atkhwwqunwmpzqkgavtx`)

See `docs/setup/DATABASE_MIGRATIONS.md` for comprehensive migration guide.

### Deployment

```bash
# Deploy to Heroku
git push heroku main

# View logs
heroku logs --tail

# Restart app
heroku restart

# Check config
heroku config
```

## Architecture

### Frontend Structure

```
src/
├── pages/              # Route components (Home, Talk, LiveTalk, MyPage, etc.)
├── components/         # Reusable UI components
│   ├── Layout.tsx      # Main layout with navigation
│   ├── TalkCard.tsx    # Auction/talk card display
│   ├── AuthModal.tsx   # Authentication modal
│   └── calls/          # Video call components
├── api/                # API client functions (auctions, callSlots, purchasedTalks, etc.)
├── lib/                # Core utilities
│   ├── supabase.ts     # Supabase client
│   ├── auth.ts         # Authentication helpers
│   ├── stripe.ts       # Stripe client
│   └── backend.ts      # Backend API URL config
├── contexts/           # React contexts (AuthContext)
└── types/              # TypeScript type definitions
```

### Backend Structure

```
backend/src/
├── server.ts           # Express app entry point, CORS, CSP, static file serving
├── routes/             # API endpoints
│   ├── calls.ts        # Call session management, room creation
│   ├── dailyWebhook.ts # Daily.co webhook for call events
│   ├── dailyAdmin.ts   # Daily.co admin operations
│   └── influencerApplication.ts  # Influencer onboarding
├── services/           # Business logic services
└── utils/              # Utility functions
```

### Database Architecture

**Key Tables**:

- `users` - User profiles (both fans and influencers)
- `call_slots` - Available talk time slots created by influencers
- `auctions` - Auction instances for call slots
- `bids` - User bids on auctions
- `purchased_talks` - Completed auction wins (payment authorized)
- `calls` - Individual call sessions within a purchased talk
- `follows` - Fan-influencer follow relationships
- `user_payments` - Payment records linked to Stripe

**User Types**: Managed via `is_influencer` boolean on `users` table.

**Payment Flow**:

1. User wins auction → `purchased_talks` created with `payment_status: 'authorized'`
2. Payment authorized via Stripe (not captured immediately)
3. After call completion → Payment captured via backend
4. Influencer receives payout via Stripe Connect

**RLS (Row Level Security)**: Enabled on all tables. Critical for multi-tenant security.

### Integration Points

**Stripe**:

- **Frontend** (`VITE_STRIPE_PUBLISHABLE_KEY`): Card input, payment method creation
- **Backend** (`STRIPE_SECRET_KEY`): Payment processing, Connect account management
- **Webhooks**: Handle payment events, Connect account updates

**Daily.co**:

- Room creation via backend API (`DAILY_API_KEY`)
- Frontend joins rooms using generated tokens
- Webhooks track participant events (join/leave/end)

**Supabase Auth**:

- Google OAuth only (no email/password)
- `AuthContext` provides user state
- `auth_user_id` links to Supabase Auth, `id` is app's internal UUID

## Important Patterns & Conventions

### Environment Variables

**Frontend** (`.env`):

- Prefix: `VITE_` (required by Vite)
- Examples: `VITE_SUPABASE_URL`, `VITE_STRIPE_PUBLISHABLE_KEY`

**Backend** (`.env`):

- No prefix needed
- Examples: `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DAILY_API_KEY`

**Heroku Config**:

- All backend env vars must be set via `heroku config:set`
- Frontend build-time vars injected during `heroku-postbuild`

### Code Change Workflow (from .cursorrules)

**CRITICAL**: Always follow this workflow:

1. **Before any code change**: Present a detailed plan including:

   - List of files to change
   - Summary of changes per file
   - Impact analysis
   - Risks and considerations

2. **Wait for explicit approval**: User must say "承認", "OK", or "進めて" before making changes

3. **Change one file at a time**: After each file change, confirm before proceeding

4. **Never**:
   - Make unsolicited "improvements" or optimizations
   - Change files not explicitly discussed
   - Proceed without approval

### API Calls Pattern

All API calls go through `src/api/` modules. Example:

```typescript
// src/api/auctions.ts
import { supabase } from "../lib/supabase";

export async function fetchAuctions() {
  const { data, error } = await supabase
    .from("auctions")
    .select("*, call_slots(*), bids(*)");
  // ...
}
```

Frontend components import and use these API functions directly.

### Authentication Flow

1. User signs in with Google OAuth (AuthModal.tsx)
2. Supabase Auth creates session
3. AuthContext provides `currentUser` to all components
4. Backend verifies Supabase JWT for protected endpoints

### Auction & Payment Flow

1. Influencer creates `call_slot` with start/end time
2. System auto-creates `auction` (via trigger or backend)
3. Fans place bids during auction period
4. At auction end, highest bidder wins
5. Winner authorizes payment (Stripe Payment Intent)
6. `purchased_talks` record created with `payment_status: 'authorized'`
7. After call completes, backend captures payment
8. Influencer receives payout via Stripe Connect

**Key**: Payment is **authorized** but not **captured** until after call completion. This allows refunds if call doesn't happen.

## Testing

### Test Accounts

See `docs/test/` for test account credentials and test card numbers.

**Stripe Test Cards**:

- Success: `4242 4242 4242 4242`
- Requires authentication: `4000 0025 0000 3155`

### Manual Testing Checklist

1. Google login flow
2. Create call slot (influencer)
3. Place bid (fan)
4. Win auction and authorize payment
5. Join video call (both parties)
6. Complete call and verify payment capture

## Key Documentation

- **Database Migrations**: `docs/setup/DATABASE_MIGRATIONS.md` - Complete Supabase CLI workflow
- **Deployment**: `docs/setup/UNIFIED_DEPLOYMENT.md` - Heroku deployment guide
- **Stripe Setup**: `docs/setup/STRIPE_SETUP_STEP_BY_STEP.md`
- **Daily.co Setup**: `docs/guides/DAILY_SETUP_GUIDE.md`
- **Admin Guide**: `docs/guides/ADMIN_GUIDE.md` - Admin operations
- **Auction Finalization**: `docs/guides/AUCTION_FINALIZATION_GUIDE.md`

## Deployment Architecture

**Single Heroku App**: Serves both frontend and backend

1. **Build Process** (`npm run build`):

   - Vite builds frontend → `dist/` (static files)
   - TypeScript compiles backend → `backend/dist/`

2. **Runtime** (`npm start`):

   - Express serves API routes under `/api/*`
   - Express serves frontend static files from `dist/`
   - SPA fallback: All other routes → `dist/index.html`

3. **Procfile**: `web: npm start`

**Environments**:

- **Staging**: `wioealhsienyubwegvdu` (Supabase project)
- **Production**: `atkhwwqunwmpzqkgavtx` (Supabase project)

## Common Tasks

### Adding a New API Endpoint

1. Create handler in `backend/src/routes/` or add to existing route file
2. Register route in `backend/src/server.ts` (if new router)
3. Create client function in `src/api/`
4. Use from component

### Adding a New Database Table

1. Create migration: `npx supabase migration new add_table_name`
2. Write SQL in generated file (include RLS policies!)
3. Test in Staging
4. Apply to Production
5. Update TypeScript types in `src/types/`

### Modifying RLS Policies

**HIGH RISK** - Always test thoroughly in Staging first.

1. Create migration with `ALTER POLICY` or `DROP POLICY` + `CREATE POLICY`
2. Test access patterns for all user roles
3. Verify no data leaks between users
4. Apply to Production only after thorough testing

### Debugging Payment Issues

1. Check Stripe Dashboard for Payment Intent status
2. Verify `user_payments` record in database
3. Check `purchased_talks.payment_status`
4. Review backend logs: `heroku logs --tail | grep stripe`
5. Ensure Stripe webhook secret is correct

### Debugging Video Call Issues

1. Check Daily.co Dashboard for room status
2. Verify `calls` table for room_url and token
3. Check Daily webhook logs in backend
4. Review browser console for Daily.co SDK errors
5. Ensure `DAILY_API_KEY` is set correctly

## Supabase Edge Functions

Located in `supabase/functions/`:

- `finalize-auctions` - Cron job to close auctions
- `finalize-buy-now-auction` - Immediate auction finalization
- `notify-new-talk-slot` - Email notifications for new slots

**Deploy**:

```bash
SUPABASE_ACCESS_TOKEN="sbp_1d376e515f374d89cf3a887b037c70f83e4ad6a6" npx supabase functions deploy function_name --project-ref [project-ref]
```

## Caveats & Known Issues

1. **No Email/Password Auth**: Only Google OAuth is implemented
2. **Timezone Handling**: All times in database are UTC; frontend handles conversion
3. **Payment Authorization Window**: Stripe authorizations expire after 7 days
4. **Daily.co Room Limits**: Free tier has meeting duration limits
5. **Heroku Dyno Sleep**: Free/hobby dynos sleep after 30min inactivity
6. **CORS Configuration**: Frontend and backend must be on allowed origins list

## Security Considerations

- **Never commit** `.env` files
- **Always use** Supabase Service Role Key only in backend
- **Always enable** RLS on new tables
- **Always validate** user permissions in RLS policies
- **Never trust** client-side data; validate in backend
- **Use** Stripe webhook signatures to verify events
- **Rotate** API keys periodically

## Project Context

For historical context and legacy patterns, see `.claude/project-context.md` if it exists.

For AI workflow guidelines specific to this project, see `docs/CODE_CHANGE_WORKFLOW.md`.
