# ビジネス用語集

## 概要

OshiTalk（推しトーク）で使用されるビジネス用語、技術用語、略語の定義集です。要件ドキュメントや開発時の認識統一に使用します。

---

## コアコンセプト

### OshiTalk（推しトーク）
インフルエンサーとファンをつなぐ、オークション形式のビデオ通話プラットフォーム。ファンがオークションで入札し、落札したTalk枠で1対1の通話を実施できる。

---

## ユーザー種別

### ファン (Fan)
インフルエンサーのTalk枠を購入し、通話を楽しむユーザー。オークションに入札または即決購入でTalk枠を獲得する。

### インフルエンサー (Influencer)
Talk枠を作成・販売し、ファンと通話を実施して収益を得るユーザー。`users.is_influencer = true` で識別される。

---

## Talk関連

### Talk枠 (Call Slot)
インフルエンサーが提供する通話枠。通話開始予定時刻、通話時間、価格設定などが含まれる。オークション形式で販売される。

**データベーステーブル**: `call_slots`

### Talk（通話）
インフルエンサーとファンの1対1ビデオ通話。予定時刻にDaily.coを使用して実施される。

### 通話開始予定時刻 (Scheduled Start Time)
Talkが開始される予定の日時。日本時間（Asia/Tokyo）で管理される。

### 通話時間 (Duration)
Talkの予定時間（分単位）。デフォルトは30分。

### 通話ステータス (Call Status)
Talkの進行状態を示すステータス。
- `upcoming`: 予定時刻の30分以上前
- `ready`: 予定時刻の前後30分以内（通話可能）
- `in_progress`: 通話中
- `completed`: 通話完了
- `cancelled`: 通話キャンセル（不成立）

---

## オークション関連

### オークション (Auction)
Talk枠を競売形式で販売する仕組み。リアルタイム入札と即決購入の2つの方式をサポート。

**データベーステーブル**: `auctions`

### 入札 (Bid)
ファンがオークションで提示する購入希望価格。最高入札者が落札する。

**データベーステーブル**: `bids`

### 開始価格 (Starting Price)
オークションの最低入札価格。この金額以上で入札を受け付ける。

### 最小入札単位 (Minimum Bid Increment)
入札時の最小増加額。デフォルトは100円。

### 即決価格 (Buy Now Price)
オークションを待たずに即座に購入できる価格。任意設定。

### 最高入札額 (Current Highest Bid)
オークションの現在の最高入札額。

### 落札 (Win Auction)
オークション終了時に最高入札者となり、Talk枠を獲得すること。

### 落札者 (Winner)
オークションで最高入札額を提示し、Talk枠を獲得したユーザー。

### オークション終了時刻 (Auction End Time)
オークションが自動的に終了する日時。通常、Talk開始時刻の1時間前に設定される。

### オークションステータス (Auction Status)
オークションの進行状態。
- `active`: 開催中
- `ended`: 終了済み

---

## 決済関連

### 与信確保 (Authorization)
入札時にカードの有効性を確認し、金額を一時的に「保留」する処理。実際の引き落としはまだ行わない。Stripe Payment Intentを使用。

**目的**: カードの有効性確認、利用可能額の確保

**有効期限**: 最大7日間

### 決済確定 (Capture)
Talk完了後に与信を確定し、実際に決済を実行する処理。

**タイミング**: Talk正常完了後

### 与信解放 (Cancel)
Talk不成立時またはオークション落札失敗時に与信を解放する処理。ファンのカードに課金されない。

**タイミング**: Talk不成立、オークション落札失敗

### Payment Intent
Stripeの決済オブジェクト。与信確保（Authorization）から決済確定（Capture）までの一連の処理を管理。

### Payment Method
Stripeに登録されたカード情報。PaymentMethodをStripe顧客にアタッチして使用する。

### Stripe顧客 (Stripe Customer)
Stripeで管理されるユーザーアカウント。`users.stripe_customer_id` に保存される。

### プラットフォーム手数料 (Platform Fee)
決済額の一定割合をプラットフォームが徴収する手数料。現在未実装。

### インフルエンサー配分 (Influencer Payout)
決済額からプラットフォーム手数料を引いた、インフルエンサーへの支払額。

---

## Daily.co関連

### Daily.co
WebRTCベースのビデオ通話プラットフォーム。OshiTalkはDaily.coのAPIを使用して通話機能を実装。

### ルーム (Room)
Daily.coで作成される通話空間。各Talkごとに専用ルームが作成される。

### ルーム終了理由 (Room End Reason)
ルームが終了した理由。
- `duration`: 規定時間経過による自動終了
- `manual`: 手動終了ボタンによる終了

### インフルエンサーno-show
インフルエンサーが予定時刻になっても通話ルームに参加しないこと。この場合、ファンへの課金はキャンセルされる。

### 途中退出 (Left Early)
規定時間前に通話から退出すること。インフルエンサーが途中退出した場合、ファンへの課金はキャンセルされる。

### Webhook
Daily.coからの通話イベント通知。`participant.joined`, `participant.left`, `room.ended` などのイベントを受信し、データベースに記録。

**実装**: `backend/src/routes/dailyWebhook.ts`

---

## フォロー関連

### フォロー (Follow)
ファンがインフルエンサーをお気に入り登録する機能。フォロー中のインフルエンサーのTalk枠は優先表示される。

**データベーステーブル**: `follows`

### フォロワー (Follower)
インフルエンサーをフォローしているファン。

### フォロワー数 (Follower Count)
インフルエンサーをフォローしているファンの数。

### フォロー中 (Following)
ファンがフォローしているインフルエンサーの一覧。

---

## ランキング関連

### 総売上ランキング (Total Earnings Ranking)
インフルエンサーの総売上額順のランキング。`users.total_earned` を基準にソート。

### 完了Talk数ランキング (Total Calls Ranking)
インフルエンサーの完了Talk数順のランキング。`users.total_calls_completed` を基準にソート。

### 平均評価ランキング (Average Rating Ranking)
インフルエンサーの平均評価順のランキング。`users.average_rating` を基準にソート。将来実装予定。

### フォロワー数ランキング (Follower Count Ranking)
インフルエンサーのフォロワー数順のランキング。`users.follower_count` を基準にソート。将来実装予定。

---

## データベーステーブル

### users
ユーザー情報テーブル。ファンとインフルエンサー両方を管理。

**主要フィールド**:
- `is_influencer`: インフルエンサーフラグ
- `stripe_customer_id`: Stripe顧客ID
- `has_payment_method`: カード登録済みフラグ
- `total_earned`: 総売上額
- `total_calls_completed`: 完了Talk数
- `average_rating`: 平均評価

### call_slots
Talk枠テーブル。インフルエンサーが作成したTalk枠を管理。

### auctions
オークションテーブル。Talk枠のオークション情報を管理。

### bids
入札テーブル。オークションへの入札履歴を管理。

### purchased_slots
購入済みTalk枠テーブル。オークション落札後のTalk枠を管理。

### follows
フォローテーブル。ファンとインフルエンサーのフォロー関係を管理。

### payment_transactions
決済トランザクションテーブル。決済確定時のトランザクション情報を管理。

### daily_call_events
Daily.coイベントログテーブル。通話イベント（参加・退出・終了）を記録。

---

## 技術用語

### Supabase
PostgreSQLを拡張したBaaS（Backend as a Service）。データベース、認証、ストレージ、Edge Functionsを提供。

### RLS (Row Level Security)
PostgreSQLの行レベルセキュリティ。ユーザーごとにアクセス可能なデータを制限する。

### Supabase Auth
Supabaseが提供する認証サービス。OAuth（Google等）、メール/パスワード認証をサポート。

### JWT (JSON Web Token)
認証トークン形式。ユーザーのセッション管理に使用。

### OAuth
外部サービス（Google等）を使用したログイン方式。

### Stripe
決済プラットフォーム。カード決済、サブスクリプション、Connectによるマーケットプレイス決済を提供。

### Stripe Connect
複数の売り手（インフルエンサー）に支払いを振り分けるStripeの機能。将来実装予定。

### PCI DSS
Payment Card Industry Data Security Standard。クレジットカード情報を安全に扱うためのセキュリティ基準。

### WebRTC
Web Real-Time Communication。ブラウザ間でP2P通信を実現する技術。

### Edge Function
サーバーレス関数。Supabase Edge Functionsは定期実行やイベント駆動で実行される。

---

## 略語

| 略語 | 正式名称 | 意味 |
|------|---------|------|
| BR | Business Requirement | 業務要件 |
| FR | Functional Requirement | 機能要件 |
| NFR | Non-Functional Requirement | 非機能要件 |
| US | User Story | ユーザーストーリー |
| RLS | Row Level Security | 行レベルセキュリティ |
| JWT | JSON Web Token | 認証トークン |
| OAuth | Open Authorization | オープン認証 |
| PCI DSS | Payment Card Industry Data Security Standard | 決済カード業界データセキュリティ基準 |
| API | Application Programming Interface | アプリケーション・プログラミング・インターフェース |
| WebRTC | Web Real-Time Communication | ウェブリアルタイムコミュニケーション |
| HTTPS | HyperText Transfer Protocol Secure | 暗号化HTTP通信 |
| CSV | Comma-Separated Values | カンマ区切りデータ形式 |
| PDF | Portable Document Format | ポータブルドキュメント形式 |

---

## ステータス定義

### オークションステータス
- `active`: オークション開催中
- `ended`: オークション終了済み

### 通話ステータス
- `upcoming`: 予定時刻の30分以上前
- `ready`: 予定時刻の前後30分以内（通話可能）
- `in_progress`: 通話中
- `completed`: 通話完了
- `cancelled`: 通話キャンセル（不成立）

### 決済ステータス
- `authorized`: 与信確保済み（決済保留）
- `captured`: 決済確定済み
- `cancelled`: 与信解放済み

---

## 日時表示ルール

### タイムゾーン
すべて日本時間（Asia/Tokyo）で表示。データベースはUTCで保存。

### フォーマット
`YYYY/MM/DD HH:MM`

**例**: `2025/12/10 14:30`

---

## 価格表記

### 通貨
日本円（JPY）のみサポート。

### 表記形式
`¥1,000` または `1,000円`

### 最小単位
1円（整数のみ）

---

## 関連ドキュメント

- [業務要件README](./README.md) - 業務要件ドキュメント全体の概要
- [技術仕様](../functional/functions/) - 実装詳細
- [技術スタック](../guides/TECH_STACK.md) - 使用技術の詳細

---

**最終更新日**: 2025-12-10
