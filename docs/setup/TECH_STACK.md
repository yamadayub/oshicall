# 推しトーク 技術構成

## 📋 概要

推しトークはインフルエンサーとファンの1対1ビデオ通話オークションサービスです。本ドキュメントでは使用している技術スタックとアーキテクチャを整理して説明します。

## 🏗️ アーキテクチャ概要

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (React SPA)   │◄──►│   (Node.js)     │◄──►│   (PostgreSQL)  │
│                 │    │                 │    │                 │
│ • React 18      │    │ • Express.js    │    │ • Supabase      │
│ • TypeScript    │    │ • TypeScript    │    │ • PostgREST     │
│ • Vite          │    │ • REST API      │    │ • RLS           │
│ • TailwindCSS   │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Video         │    │   Payment       │    │   Auth          │
│   (Daily.co)    │    │   (Stripe)      │    │   (Supabase)    │
│                 │    │                 │    │                 │
│ • WebRTC        │    │ • Connect       │    │ • JWT           │
│ • Real-time     │    │ • Webhook       │    │ • OAuth         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔧 フロントエンド (Frontend)

### コアフレームワーク
- **React 18.2.0** - UIライブラリ
- **TypeScript 5.2.2** - 型安全なJavaScript
- **Vite 5.4.8** - 高速ビルドツール

### UI/スタイリング
- **TailwindCSS 3.4.1** - ユーティリティファーストCSSフレームワーク
- **Lucide React 0.344.0** - アイコンライブラリ
- **Headless UI** - アクセシブルなUIコンポーネント

### 状態管理 & ルーティング
- **React Router 6.21.3** - クライアントサイドルーティング
- **React Context API** - グローバル状態管理

### 外部サービス連携
- **@supabase/supabase-js 2.57.4** - Supabaseクライアント
- **@daily-co/daily-js 0.84.0** - ビデオ通話SDK
- **@daily-co/daily-react 0.23.2** - React用ビデオ通話コンポーネント
- **@stripe/stripe-js 8.0.0** - Stripe決済
- **@stripe/react-stripe-js 5.2.0** - React用Stripeコンポーネント

## 🚀 バックエンド (Backend)

### ランタイム & フレームワーク
- **Node.js 22.x** - JavaScriptランタイム
- **Express.js 4.18.2** - Webアプリケーションフレームワーク
- **TypeScript 5.3.3** - 型安全なJavaScript

### API & ミドルウェア
- **REST API** - RESTful API設計
- **CORS** - クロスオリジンリソース共有
- **Helmet** - セキュリティヘッダー
- **Compression** - レスポンス圧縮

### 開発ツール
- **Nodemon 3.0.2** - 自動再起動
- **TypeScript Compiler** - TypeScriptコンパイル
- **ESLint** - コード品質チェック

## 🗄️ データベース (Database)

### コアシステム
- **PostgreSQL 15** - リレーショナルデータベース
- **Supabase** - PostgreSQLを拡張したBaaS
- **PostgREST** - PostgreSQLをREST API化

### セキュリティ & 機能
- **Row Level Security (RLS)** - 行レベルセキュリティ
- **Real-time subscriptions** - リアルタイムデータ同期
- **Built-in Auth** - 認証・認可機能
- **Storage** - ファイルストレージ
- **Edge Functions** - サーバーレス関数

### マイグレーション
- **Supabase CLI** - マイグレーションツール
- **SQL migrations** - バージョン管理されたスキーマ変更

## 🎥 ビデオ通話 (Video)

### コアサービス
- **Daily.co** - WebRTCベースのビデオ通話プラットフォーム
- **WebRTC** - ブラウザ間P2P通信
- **Real-time communication** - 低遅延ビデオ/音声通信

### 機能
- **HDビデオ通話** - 高品質ビデオ
- **Screen sharing** - 画面共有
- **Recording** - 通話録画（将来拡張）
- **Chat** - テキストチャット（将来拡張）

## 💳 決済システム (Payment)

### Stripe統合
- **Stripe Connect** - プラットフォーム決済
- **Express accounts** - インフルエンサーアカウント管理
- **Webhooks** - 決済イベント処理
- **Payouts** - 自動振込

### 決済フロー
1. **Authorization** - 仮決済（オークション終了時）
2. **Capture** - 本決済（通話完了時）
3. **Payout** - インフルエンサーへの振込

## 🔐 認証・認可 (Authentication)

### Supabase Auth
- **Email/Password** - 基本認証
- **OAuth** - Google, GitHub等ソーシャルログイン
- **JWT tokens** - セッション管理
- **Password reset** - パスワードリセット

### アクセス制御
- **Row Level Security** - データベースレベルアクセス制御
- **APIミドルウェア** - アプリケーションレベルアクセス制御
- **ユーザー権限** - ファン/インフルエンサー権限管理

## 📦 デプロイ & CI/CD

### ホスティング
- **Heroku** - アプリケーションサーバー
- **Supabase** - データベース & API
- **Vercel** - 静的アセット（将来拡張）

### デプロイメント
- **Git** - バージョン管理
- **GitHub Actions** - CI/CDパイプライン（将来拡張）
- **Environment variables** - 環境別設定管理

## 🛠️ 開発環境

### ローカル開発
- **Vite dev server** - 高速開発サーバー
- **Hot Module Replacement** - ホットリロード
- **ESLint + Prettier** - コード品質管理

### デバッグ & モニタリング
- **Browser DevTools** - フロントエンドデバッグ
- **Supabase Dashboard** - データベース管理
- **Heroku Logs** - サーバーログ

## 📊 パフォーマンス最適化

### フロントエンド
- **Code splitting** - バンドル分割
- **Lazy loading** - 遅延読み込み
- **Image optimization** - 画像最適化
- **Caching** - ブラウザキャッシュ

### バックエンド
- **Compression** - レスポンス圧縮
- **Connection pooling** - データベース接続プール
- **Rate limiting** - リクエスト制限（将来拡張）

## 🔒 セキュリティ

### データ保護
- **HTTPS** - 通信の暗号化
- **CORS** - クロスオリジン制御
- **Helmet** - セキュリティヘッダー
- **Input validation** - 入力値検証

### 認証セキュリティ
- **JWT tokens** - セキュアなトークン認証
- **Password hashing** - パスワードハッシュ化
- **Session management** - セッション管理
- **CSRF protection** - CSRF対策

## 📈 スケーラビリティ

### 現在のアーキテクチャ
- **Stateless backend** - ステートレス設計
- **Supabase scaling** - 自動スケーリング
- **CDN** - 静的アセット配信

### 将来の拡張性
- **Microservices** - マイクロサービス化
- **Load balancing** - 負荷分散
- **Database sharding** - データベース分散
- **Caching layer** - Redis等キャッシュ層

## 🎯 技術選定の理由

### React + TypeScript
- **型安全性** - ランタイムエラーの削減
- **開発体験** - 優れたDXとエコシステム
- **パフォーマンス** - Virtual DOMによる効率的なレンダリング

### Supabase
- **統合性** - Auth, DB, Storage, Edge Functions
- **開発速度** - サーバー構築不要
- **スケーラビリティ** - PostgreSQLベース
- **リアルタイム** - 組み込みリアルタイム機能

### Daily.co
- **品質** - 高品質ビデオ通話
- **開発容易性** - SDKが充実
- **スケーラビリティ** - 大規模利用可能

### Stripe
- **信頼性** - 世界標準の決済プラットフォーム
- **コンプライアンス** - PCI DSS準拠
- **機能豊富** - Connect, Webhooks等充実

---

## 📝 更新履歴

- **2025-01-21**: 初回作成 - 技術構成の包括的整理
- **2025-01-XX**: 更新予定 - 新機能追加時の技術スタック更新

## 🔗 関連ドキュメント

- [開発ガイド](./DEVELOPMENT.md)
- [API仕様](./../api/)
- [デプロイスクリプト](./../deployment/DEPLOYMENT.md)
- [データベース設計](./../api/TABLE_SCHEMA_MCP.md)