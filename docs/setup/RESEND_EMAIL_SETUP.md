# Resend 任意アドレスへのメール送信設定ガイド

## 📋 問題の概要

Resendの無料プランや開発モードでは、**承認済みメールアドレス**にしか送信できません。本番環境で任意のユーザーにメール（オークション通知、Talk開始通知など）を送るには、以下の設定が必要です。

## 🎯 必要な条件

任意のアドレスにメールを送信するには、以下の条件をすべて満たす必要があります：

1. ✅ **ドメイン認証完了**（DNS設定）
2. ✅ **Production APIキーを使用**
3. ⚠️ **Resend Dashboardでドメインが "Verified" 状態**
4. ⚠️ **適切なプラン（無料プランでも可能だが制限あり）**

## 📊 Resendプラン比較

| プラン | 月額 | 送信数/月 | 送信先制限 | 推奨用途 |
|--------|------|-----------|-----------|----------|
| **Free** | $0 | 3,000通 | ドメイン認証完了で任意アドレス可 | 開発・小規模テスト |
| **Pro** | $20~ | 50,000通~ | 任意アドレス | 本番環境 |
| **Enterprise** | 要相談 | カスタム | 任意アドレス | 大規模運用 |

**結論:** ドメイン認証が完了していれば、**無料プランでも任意のアドレスに送信可能**です。ただし、月3,000通の制限があります。

## 🚀 設定手順（ステップバイステップ）

### ステップ1: Resend Dashboardでドメイン認証状態を確認

1. [Resend Dashboard > Domains](https://resend.com/domains) にアクセス

2. `oshi-talk.com` のステータスを確認

   **期待する状態:**
   ```
   Domain: oshi-talk.com
   Status: ✅ Verified
   SPF: ✅ Valid
   DKIM: ✅ Valid
   DMARC: ✅ Valid
   ```

3. もし "Pending" や "Not Verified" の場合、DNS設定を確認

### ステップ2: DNS設定の確認（Cloudflare）

Cloudflare DNSに以下のレコードが正しく設定されているか確認します。

#### 必要なDNSレコード

1. **SPFレコード**
   ```
   Type: TXT
   Name: @
   Value: v=spf1 include:_spf.google.com include:_spf.resend.com ~all
   ```

2. **DKIMレコード**
   ```
   Type: TXT
   Name: resend._domainkey
   Value: （Resend Dashboardで提供される値）
   ```

3. **DMARCレコード**
   ```
   Type: TXT
   Name: _dmarc
   Value: v=DMARC1; p=none
   ```

#### 確認方法

```bash
# SPFレコード確認
dig TXT oshi-talk.com +short

# DKIMレコード確認
dig TXT resend._domainkey.oshi-talk.com +short

# DMARCレコード確認
dig TXT _dmarc.oshi-talk.com +short
```

### ステップ3: Production APIキーの確認

1. [Resend Dashboard > API Keys](https://resend.com/api-keys) にアクセス

2. **Production環境用のAPIキー**を確認
   - 名前: Production API Key（または類似）
   - 権限: Full Access または Send emails

3. APIキーがSupabase Edge Functionsに正しく設定されているか確認

   ```bash
   # Supabase secretsを確認
   SUPABASE_ACCESS_TOKEN="your_token" \
     npx supabase secrets list --project-ref atkhwwqunwmpzqkgavtx

   # 期待する出力:
   # RESEND_API_KEY=re_...
   # FROM_EMAIL=OshiTalk <noreply@oshi-talk.com>
   # APP_URL=https://oshi-talk.com
   ```

4. もしAPIキーが設定されていない、または古い場合は再設定

   ```bash
   SUPABASE_ACCESS_TOKEN="your_token" \
     npx supabase secrets set \
     RESEND_API_KEY=re_your_production_api_key \
     --project-ref atkhwwqunwmpzqkgavtx
   ```

### ステップ4: ドメイン検証（Resend Dashboard）

1. [Resend Dashboard > Domains](https://resend.com/domains) で `oshi-talk.com` をクリック

2. **"Verify Domain"** ボタンをクリック

3. 検証結果を確認
   - ✅ すべてグリーンチェックになればOK
   - ❌ 赤いエラーが出た場合、DNS設定を修正

### ステップ5: テスト送信

#### 5.1 Resend Dashboard経由でテスト

1. [Resend Dashboard > Emails](https://resend.com/emails) にアクセス

2. **"Send Test Email"** をクリック

3. 以下の内容で送信テスト:
   ```
   From: noreply@oshi-talk.com
   To: your-personal-email@example.com（任意のアドレス）
   Subject: Test Email
   Body: This is a test email from OshiTalk.
   ```

4. 送信が成功し、メールが届くことを確認

#### 5.2 Supabase Edge Function経由でテスト

実際のEdge Functionを呼び出してテスト:

```bash
# Edge Functionを呼び出し
curl -X POST https://atkhwwqunwmpzqkgavtx.supabase.co/functions/v1/send-notification \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "your-test-email@example.com",
    "subject": "OshiTalk Test Notification",
    "html": "<p>This is a test notification from OshiTalk.</p>"
  }'
```

### ステップ6: プランのアップグレード（必要な場合）

無料プランの月3,000通では不足する場合、Proプランにアップグレードします。

#### アップグレード手順

1. [Resend Dashboard > Settings > Billing](https://resend.com/settings/billing) にアクセス

2. **"Upgrade to Pro"** をクリック

3. プランを選択
   - **Pro Plan**: $20/月（50,000通）
   - カスタムプランが必要な場合は "Contact Sales"

4. 支払い情報を入力して完了

#### プラン選択の目安

**ユーザー数とメール送信数の試算:**

| ユーザー数 | 1日の通知数/人 | 月間送信数 | 推奨プラン |
|-----------|---------------|-----------|-----------|
| ~100人 | 1通 | ~3,000通 | Free |
| ~1,000人 | 2通 | ~60,000通 | Pro (50,000通) |
| ~5,000人 | 2通 | ~300,000通 | Pro (250,000通) |

**通知の種類:**
- オークション開始通知
- 入札通知
- 落札通知
- Talk開始通知
- 決済完了通知
- リマインダー

## 🧪 トラブルシューティング

### 問題1: ドメインが "Pending" のまま

**原因:** DNS設定が反映されていない、または誤っている

**解決策:**
1. Cloudflare DNSで設定を再確認
2. DNS伝播を待つ（最大48時間、通常は1-2時間）
3. DNS伝播確認ツールを使用: https://dnschecker.org/

### 問題2: "Domain not verified" エラー

**原因:** ドメイン検証が完了していない

**解決策:**
1. Resend Dashboardで "Verify Domain" を再実行
2. DNSレコードが正確か確認（特にDKIM値）
3. Resendサポートに問い合わせ

### 問題3: メールが届かない（スパム扱い）

**原因:** SPF/DKIM/DMARC設定の不備

**解決策:**
1. DNS設定を再確認
2. DMARCポリシーを `p=quarantine` に変更（より厳格）
   ```
   v=DMARC1; p=quarantine; rua=mailto:dmarc@oshi-talk.com
   ```
3. メール送信元を確認（必ず `noreply@oshi-talk.com` を使用）

### 問題4: APIキーが無効

**原因:** APIキーが期限切れ、または削除されている

**解決策:**
1. Resend Dashboardで新しいAPIキーを生成
2. Supabase secretsを更新
3. Edge Functionsを再デプロイ

## 📝 現在の設定状態（確認チェックリスト）

### Production環境（oshi-talk.com）

- [ ] Resendドメイン認証: `oshi-talk.com` → Status: Verified
- [ ] Cloudflare DNS設定:
  - [ ] SPF レコード設定済み
  - [ ] DKIM レコード設定済み
  - [ ] DMARC レコード設定済み
- [ ] Resend Production APIキー取得
- [ ] Supabase Edge Functions環境変数設定:
  - [ ] `RESEND_API_KEY` 設定済み
  - [ ] `FROM_EMAIL` = `OshiTalk <noreply@oshi-talk.com>`
  - [ ] `APP_URL` = `https://oshi-talk.com`
- [ ] テスト送信成功（任意のアドレスに送信できる）
- [ ] Resendプラン確認（Free or Pro）

### Staging環境（staging.oshi-talk.com）

- [ ] 親ドメイン（oshi-talk.com）の認証を継承
- [ ] Supabase Edge Functions環境変数設定（Staging用）
- [ ] テスト送信成功

## 🔗 参考リンク

- **Resend Dashboard**: https://resend.com/
- **Resend Documentation**: https://resend.com/docs
- **Domain Authentication Guide**: https://resend.com/docs/dashboard/domains/introduction
- **DNS Checker**: https://dnschecker.org/

## 📞 サポート

問題が解決しない場合:

1. **Resendサポート**: https://resend.com/support
2. **Resend Discord**: https://discord.gg/resend
3. **ドキュメント**: https://resend.com/docs

## 🎯 次のステップ

1. ✅ このガイドに従ってドメイン認証を確認
2. ✅ テスト送信で動作確認
3. ⏭️ アプリケーションに通知機能を実装
   - オークション開始通知
   - 落札通知
   - Talk開始リマインダー
4. ⏭️ 必要に応じてProプランにアップグレード

---

**最終更新**: 2025-11-22
