# 🔒 GitHub Push Protection 対応完了

## ✅ 実施した対策

### 1. API キーの削除

すべてのドキュメントファイル内の実際の API キーをプレースホルダーに置き換えました：

- `UNIFIED_DEPLOYMENT.md`
- `BIDDING_SYSTEM_COMPLETE.md`
- `VIDEO_CALL_SUCCESS.md`
- `SUPABASE_EDGE_FUNCTIONS_SETUP.md`
- `AUCTION_SYSTEM_COMPLETE.md`
- `AUCTION_FINALIZATION_GUIDE.md`
- `NEXT_STEPS.md`

### 2. 置き換えた内容

```
❌ sk_test_51SGh0T... → ✅ sk_test_YOUR_SECRET_KEY
❌ pk_test_51SGh0T... → ✅ pk_test_YOUR_PUBLISHABLE_KEY
❌ wioealhsienyubwegvdu → ✅ your-project-id
❌ bbc2e4684848... → ✅ your_daily_api_key
```

---

## 🚀 次のステップ（選択肢）

### オプション 1: GitHub で一時許可（最も簡単）⭐

1. **この URL をブラウザで開く：**

   ```
   https://github.com/aisukoohiikudasai-sketch/oshicall/security/secret-scanning/unblock-secret/341tOaLTc8vrJrRAtbD2ucQZ0Bc
   ```

2. **「Allow secret」ボタンをクリック**

3. **再度プッシュ：**

   ```bash
   git push origin main
   ```

4. **完了！** ✅

> ⚠️ **注意**: この方法は一時的な許可です。将来的には過去の履歴をクリーンアップすることをおすすめします。

---

### オプション 2: Git 履歴をクリーンアップ（推奨・時間がある場合）

#### Step 1: git-filter-repo をインストール

```bash
pip3 install git-filter-repo
```

#### Step 2: API キーを含むコミットを削除

```bash
# バックアップ
git clone . ../oshicall-backup

# 機密情報を含むファイルの履歴を書き換え
git filter-repo --invert-paths \
  --path UNIFIED_DEPLOYMENT.md \
  --path BIDDING_SYSTEM_COMPLETE.md \
  --path VIDEO_CALL_SUCCESS.md \
  --force

# または特定の文字列を削除
git filter-repo --replace-text <(echo 'sk_test_51SGh0T==>[REMOVED]')
```

#### Step 3: 強制プッシュ

```bash
git push origin main --force
```

⚠️ **注意**: `--force`は履歴を書き換えるため、チーム開発では注意が必要です。

---

### オプション 3: 新しいブランチで再スタート

過去の履歴を捨てて、クリーンな状態から始める：

```bash
# 現在の状態を新しいブランチに
git checkout --orphan clean-main

# すべてをコミット
git add -A
git commit -m "Initial clean commit without sensitive data"

# 古いmainを削除して新しいmainに
git branch -D main
git branch -m main

# 強制プッシュ
git push origin main --force
```

---

## 📝 今後の対策

### 1. .gitignore に環境変数ファイルを追加

```bash
# すでに追加済み
.env
.env.local
backend/.env
```

### 2. pre-commit フックでチェック

```bash
# git-secrets をインストール
brew install git-secrets

# リポジトリに設定
git secrets --install
git secrets --register-aws
git secrets --add 'sk_test_[0-9A-Za-z]+'
git secrets --add 'pk_test_[0-9A-Za-z]+'
```

### 3. ドキュメントには常にプレースホルダーを使用

```bash
✅ STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY
❌ STRIPE_SECRET_KEY=sk_test_51SGh0T...
```

---

## 🎯 推奨アクション

**今すぐ:** オプション 1（GitHub で一時許可）
**後で時間があるとき:** オプション 2（Git 履歴クリーンアップ）

---

✅ API キーの削除は完了しました！
あとは上記のいずれかの方法で GitHub にプッシュするだけです。
