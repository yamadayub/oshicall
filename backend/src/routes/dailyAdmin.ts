// Daily.co管理用エンドポイント（Webhook設定など）
import { Router, Request, Response } from 'express';
import {
  createDailyWebhook,
  listDailyWebhooks,
  deleteDailyWebhook
} from '../utils/daily';

const router = Router();

// Supabaseクライアントを受け取る関数
export const createDailyAdminRouter = (supabase: any) => {

/**
 * GET /api/daily-admin/webhooks
 * Webhook一覧を取得
 */
router.get('/webhooks', async (req: Request, res: Response) => {
  try {
    const webhooks = await listDailyWebhooks();

    res.json({
      success: true,
      webhooks,
      count: webhooks.length
    });

  } catch (error: any) {
    console.error('❌ Webhook一覧取得エラー:', error);
    res.status(500).json({
      error: error.message || 'Webhook一覧取得に失敗しました'
    });
  }
});

/**
 * POST /api/daily-admin/webhooks
 * Webhookを作成
 *
 * Body:
 * {
 *   "webhookUrl": "https://your-app.com/api/daily/webhook"
 * }
 */
router.post('/webhooks', async (req: Request, res: Response) => {
  try {
    const { webhookUrl } = req.body;

    if (!webhookUrl) {
      return res.status(400).json({ error: 'webhookUrl is required' });
    }

    // URLのバリデーション
    try {
      new URL(webhookUrl);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Webhookを作成
    const webhook = await createDailyWebhook(webhookUrl);

    res.json({
      success: true,
      webhook,
      message: 'Webhook作成成功'
    });

  } catch (error: any) {
    console.error('❌ Webhook作成エラー詳細:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText
    });
    res.status(500).json({
      error: error.message || 'Webhook作成に失敗しました',
      details: error.response?.data || null
    });
  }
});

/**
 * DELETE /api/daily-admin/webhooks/:webhookId
 * Webhookを削除
 */
router.delete('/webhooks/:webhookId', async (req: Request, res: Response) => {
  try {
    const { webhookId } = req.params;

    if (!webhookId) {
      return res.status(400).json({ error: 'webhookId is required' });
    }

    await deleteDailyWebhook(webhookId);

    res.json({
      success: true,
      message: 'Webhook削除成功'
    });

  } catch (error: any) {
    console.error('❌ Webhook削除エラー:', error);
    res.status(500).json({
      error: error.message || 'Webhook削除に失敗しました'
    });
  }
});

return router;
};
