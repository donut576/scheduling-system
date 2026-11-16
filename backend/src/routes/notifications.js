import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { listMyNotifications, markRead, markAllRead } from '../services/inAppNotifications.js';
import { listMailLog, runDailyMail, getMySettings, saveMySettings } from '../services/mailDigest.js';
import { runLicenseExpiryCheck } from '../services/licenseExpiry.js';

// 站內通知：每個人只能看、只能標記自己的（後端一律用登入者判斷，不看前端傳的 recipientId）
export const notificationsRouter = Router();

// channel=IN_APP：自己的站內通知；沒帶 channel：寄信的發送紀錄（主任只看自己寄的，只含最近幾天）
notificationsRouter.get('/notifications', requireAuth, requirePermission('notification:view'),
  asyncHandler(async (req, res) => ok(res, req.query.channel === 'IN_APP'
    ? await listMyNotifications(req.user, req.query)
    : await listMailLog(req.user, req.query))));

notificationsRouter.post('/notifications/read-all', requireAuth, requirePermission('notification:view'),
  asyncHandler(async (req, res) => ok(res, await markAllRead(req.user))));

notificationsRouter.patch('/notifications/:id/read', requireAuth, requirePermission('notification:view'),
  asyncHandler(async (req, res) => ok(res, await markRead(req.user, req.params.id))));

// 手動執行一次「證照到期檢查」（平常每 6 小時自動跑；測試或剛改完證照資料時可立刻跑）。只有管理員。
notificationsRouter.post('/notifications/jobs/license-expiry', requireAuth, requirePermission('system:settings'),
  asyncHandler(async (req, res) => ok(res, await runLicenseExpiryCheck())));

// 手動執行一次每日寄信（平常每分鐘自動檢查是否到發送時間）。force=true：不看發送時間，立刻處理所有待寄異動。只有管理員。
notificationsRouter.post('/notifications/jobs/daily-mail', requireAuth, requirePermission('system:settings'),
  asyncHandler(async (req, res) => ok(res, await runDailyMail({ force: req.query.force === 'true' }))));

// 通知設定頁：每位主任自己的發送時間與自動通知開關
notificationsRouter.get('/notification-settings/me', requireAuth, requirePermission('notification:send'),
  asyncHandler(async (req, res) => ok(res, await getMySettings(req.user))));
notificationsRouter.put('/notification-settings/me', requireAuth, requirePermission('notification:send'),
  asyncHandler(async (req, res) => ok(res, await saveMySettings(req.user, req.body))));
