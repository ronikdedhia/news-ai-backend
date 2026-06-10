import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler';
import { verifyClerkToken } from '../middleware/auth.middleware';
import { alertService } from '../services/alert.service';

const router = Router();

router.get('/', verifyClerkToken, asyncHandler(async (req, res) => {
  const notifs = await alertService.getNotifications(req.user!.id);
  return res.json({ success: true, notifications: notifs });
}));

router.get('/unread-count', verifyClerkToken, asyncHandler(async (req, res) => {
  const count = await alertService.getUnreadCount(req.user!.id);
  return res.json({ success: true, count });
}));

router.post('/read-all', verifyClerkToken, asyncHandler(async (req, res) => {
  await alertService.markAllRead(req.user!.id);
  return res.json({ success: true });
}));

router.post('/:id/read', verifyClerkToken, asyncHandler(async (req, res) => {
  await alertService.markOneRead(req.user!.id, String(req.params.id));
  return res.json({ success: true });
}));

router.delete('/:id', verifyClerkToken, asyncHandler(async (req, res) => {
  await alertService.deleteNotification(req.user!.id, String(req.params.id));
  return res.json({ success: true });
}));

export default router;
