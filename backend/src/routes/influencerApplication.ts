import { Router, Request, Response } from 'express';
import nodemailer from 'nodemailer';

const router = Router();

// インフルエンサー申請メール送信
router.post('/send-influencer-application', async (req: Request, res: Response) => {
  try {
    console.log('=== インフルエンサー申請APIリクエスト受信 ===');
    console.log('Request body:', req.body);

    const {
      userId,
      displayName,
      email,
      realName,
      affiliation,
      snsLinks
    } = req.body;

    console.log('Parsed data:', { userId, displayName, email, realName, affiliation, snsLinks });

    // バリデーション
    if (!userId || !email || email.trim() === '' || !realName || !affiliation || !snsLinks) {
      console.log('バリデーションエラー: 必須項目不足');
      return res.status(400).json({ error: '必須項目が不足しています' });
    }

    if (!Array.isArray(snsLinks) || snsLinks.length === 0) {
      console.log('バリデーションエラー: SNSリンクなし');
      return res.status(400).json({ error: 'SNSリンクが必要です' });
    }

    console.log('バリデーション通過');

    // メール本文を作成
    const snsLinksText = snsLinks.map((link, index) => `${index + 1}. ${link}`).join('\n');

    const emailBody = `
新しいインフルエンサー申請がありました。

【申請者情報】
- ユーザーID: ${userId}
- 表示名: ${displayName}
- メールアドレス: ${email}
- お名前: ${realName}
- 所属: ${affiliation}

【SNSアカウント】
${snsLinksText}

【確認URL】
管理画面でユーザーを確認: https://wioealhsienyubwegvdu.supabase.co/project/wioealhsienyubwegvdu/editor

承認する場合は、以下のSQLを実行してください：
UPDATE users SET is_influencer = true WHERE id = '${userId}';

却下する場合は、以下のSQLを実行してください：
-- 却下の場合は特に何もする必要はありません（デフォルトでis_influencer = falseのまま）
    `.trim();

    // トランスポーターを作成
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // メール送信（一時的にログ出力に変更）
    console.log('=== インフルエンサー申請受付 ===');
    console.log(`ユーザーID: ${userId}`);
    console.log(`表示名: ${displayName}`);
    console.log(`メールアドレス: ${email}`);
    console.log(`お名前: ${realName}`);
    console.log(`所属: ${affiliation}`);
    console.log(`SNSアカウント:`, snsLinks);
    console.log('=== 申請処理完了 ===');

    // メール送信（認証エラーの場合はログ出力にフォールバック）
    let emailSent = false;
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || 'OshiTalk <info@oshi-talk.com>',
        to: 'info@style-elements.jp',
        subject: `【OshiTalk】新規インフルエンサー申請 - ${realName}`,
        text: emailBody,
        replyTo: email, // 申請者のメールアドレスに返信可能
      };

      const result = await transporter.sendMail(mailOptions);
      console.log(`インフルエンサー申請メール送信成功: ${realName} (${email})`);
      console.log(`メール送信詳細:`, {
        messageId: result.messageId,
        envelope: result.envelope,
        accepted: result.accepted,
        rejected: result.rejected,
        pending: result.pending
      });
      emailSent = true;
    } catch (emailError) {
      console.log('=== メール送信失敗: ログ出力にフォールバック ===');
      console.log('SMTP認証エラーが発生しました。アプリパスワードを確認してください。');
      console.log('現在の設定:', process.env.SMTP_PASS ? '設定済み' : '未設定');
      console.log(`申請内容はログに出力されています: ${realName} (${email})`);
    }

    res.json({
      success: true,
      message: emailSent ? 'メール送信成功' : '申請受付完了（メール送信はログ出力）'
    });
  } catch (error) {
    console.error('インフルエンサー申請メール送信エラー:', error);
    res.status(500).json({ error: 'メール送信に失敗しました' });
  }
});

export default router;
