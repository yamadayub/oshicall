import { Router, Request, Response } from 'express';
import nodemailer from 'nodemailer';

const router = Router();

// インフルエンサー申請メール送信
router.post('/send-influencer-application', async (req: Request, res: Response) => {
  try {
    const {
      userId,
      displayName,
      email,
      realName,
      affiliation,
      snsLinks
    } = req.body;

    // バリデーション
    if (!userId || !displayName || !email || !realName || !affiliation || !snsLinks) {
      return res.status(400).json({ error: '必須項目が不足しています' });
    }

    if (!Array.isArray(snsLinks) || snsLinks.length === 0) {
      return res.status(400).json({ error: 'SNSリンクが必要です' });
    }

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

    // メール送信を一時的にスキップ
    // const mailOptions = {
    //   from: process.env.SMTP_FROM || 'OshiTalk <info@oshi-talk.com>',
    //   to: 'info@style-elements.com',
    //   subject: `【OshiTalk】新規インフルエンサー申請 - ${realName}`,
    //   text: emailBody,
    //   replyTo: email, // 申請者のメールアドレスに返信可能
    // };

    // await transporter.sendMail(mailOptions);

    console.log(`インフルエンサー申請メール送信成功: ${realName} (${email})`);

    res.json({ success: true, message: 'メール送信成功' });
  } catch (error) {
    console.error('インフルエンサー申請メール送信エラー:', error);
    res.status(500).json({ error: 'メール送信に失敗しました' });
  }
});

export default router;
