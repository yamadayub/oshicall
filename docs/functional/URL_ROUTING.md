# URL ルーティングガイド

React Router を使用した URL ベースのナビゲーションを実装しました。

## 🔗 URL 構造

### パブリック URL（シェア可能）

| ページ          | URL                    | 説明                       |
| --------------- | ---------------------- | -------------------------- |
| **ホーム**      | `/`                    | Talk 枠一覧                |
| **Talk 詳細**   | `/talk/:talkId`        | 特定の Talk 枠の詳細       |
| **入札履歴**    | `/bid-history/:talkId` | 特定の Talk 枠の入札履歴   |
| **ライブ Talk** | `/live-talk/:talkId`   | 特定の Talk のライブビュー |
| **ランキング**  | `/rankings`            | インフルエンサーランキング |

### ユーザー専用 URL

| ページ                             | URL                     | 説明                   |
| ---------------------------------- | ----------------------- | ---------------------- |
| **マイページ**                     | `/mypage`               | ユーザーのプロフィール |
| **Talk ページ**                    | `/talk`                 | 落札した Talk 一覧     |
| **インフルエンサーダッシュボード** | `/influencer-dashboard` | Talk 枠管理            |

## 🎯 具体的な URL 例

### ローカル開発環境

```
http://localhost:5174/
http://localhost:5174/talk/123e4567-e89b-12d3-a456-426614174000
http://localhost:5174/mypage
http://localhost:5174/influencer-dashboard
```

### 本番環境（Heroku）

```
https://oshicall-2936440db16b.herokuapp.com/
https://oshicall-2936440db16b.herokuapp.com/talk/123e4567-e89b-12d3-a456-426614174000
https://oshicall-2936440db16b.herokuapp.com/mypage
```

## 📱 SNS シェア機能

### Talk 詳細ページのシェアボタン

Talk 詳細ページに「共有」ボタンを追加しました：

```
1. Talk詳細ページを開く
2. 左上の「共有」ボタン（🔗アイコン）をクリック
3. URLがクリップボードにコピーされる
4. SNS（Twitter、Instagram、LINEなど）で貼り付け
```

### インフルエンサーの使い方

```
1. インフルエンサーダッシュボードでTalk枠を作成
2. ホーム画面でTalk枠を開く
3. 「共有」ボタンでURLをコピー
4. Twitterなどで投稿:

   「みんな〜！新しいTalk枠作ったよ🎉
   今度は○○について語り合おう！
   入札はこちらから👇
   https://oshicall-xxx.herokuapp.com/talk/abc123」
```

## 🌐 OGP（Open Graph Protocol）対応

将来的に、Talk 枠のメタタグを追加することで、SNS でのシェアがより魅力的になります：

```html
<!-- index.htmlに追加 -->
<meta property="og:title" content="あいりとのTalk - OshiTalk" />
<meta property="og:description" content="今日もお喋りしましょうね〜✨" />
<meta
  property="og:image"
  content="https://xxx.supabase.co/storage/v1/object/public/talk-images/1.jpg"
/>
<meta
  property="og:url"
  content="https://oshicall-xxx.herokuapp.com/talk/abc123"
/>
```

## 🔍 ルーティングの動作

### 直接 URL 訪問

```
https://oshicall-xxx.herokuapp.com/talk/abc123
↓
TalkDetailページが直接表示される
```

### ページ内遷移

```
ホーム → Talk枠をクリック → /talk/abc123 に遷移
```

### 戻るボタン

```
Talk詳細ページ → 「←」ボタン → / に戻る
```

## 🛠️ 開発者向け

### ルート定義（App.tsx）

```typescript
<Routes>
  <Route path="/" element={<Home />} />
  <Route path="/talk/:talkId" element={<TalkDetail />} />
  <Route path="/live-talk/:talkId" element={<LiveTalk />} />
  <Route path="/bid-history/:talkId" element={<BidHistory />} />
  <Route path="/mypage" element={<MyPage />} />
  <Route path="/rankings" element={<Rankings />} />
  <Route path="/influencer-dashboard" element={<InfluencerDashboard />} />
</Routes>
```

### URL パラメータの取得

```typescript
// ページコンポーネント内
const { talkId } = useParams<{ talkId: string }>();
```

### プログラマティックナビゲーション

```typescript
const navigate = useNavigate();
navigate("/talk/abc123");
navigate("/");
```

## 📊 メリット

### ユーザー体験

- ✅ ブックマーク可能
- ✅ ブラウザの戻る/進むボタンが機能
- ✅ リロードしても同じページが表示
- ✅ URL をシェアできる

### SEO（将来的に）

- ✅ 検索エンジンにインデックス可能
- ✅ ソーシャルメディアでのプレビュー
- ✅ アナリティクスで個別ページを追跡

### 開発

- ✅ クリーンな URL 構造
- ✅ ステート管理がシンプルに
- ✅ デバッグが容易

## 🚀 デプロイ時の注意

### Heroku

`public/_redirects` ファイルを追加済み：

```
/* /index.html 200
```

これにより、すべての URL リクエストが`index.html`にリダイレクトされ、React Router が処理します。

### Netlify

`netlify.toml` を更新済み。

---

これで、Talk 枠ごとに独自の URL が生成され、インフルエンサーが SNS で直接集客できるようになりました！🎉
