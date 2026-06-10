import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler';
import { verifyClerkToken } from '../middleware/auth.middleware';
import { bookmarkService } from '../services/bookmark.service';
import { folderService } from '../services/folder.service';

const router = Router();

router.get('/bookmarks', verifyClerkToken, asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = parseInt(req.query.offset as string) || 0;
  const folderId = req.query.folderId as string | undefined;
  const bookmarks = await bookmarkService.getUserBookmarks(req.user!.id, limit, offset, folderId);
  return res.json({
    success: true,
    count: bookmarks.length,
    bookmarks: bookmarks.map(b => ({ ...b, isBookmarked: true })),
  });
}));

router.put('/bookmarks/:articleId/folder', verifyClerkToken, asyncHandler(async (req, res) => {
  const { folderId } = req.body as { folderId: string | null };
  await folderService.assignToFolder(req.user!.id, String(req.params.articleId), folderId ?? null);
  return res.json({ success: true });
}));

router.get('/folders', verifyClerkToken, asyncHandler(async (req, res) => {
  const folders = await folderService.getFolders(req.user!.id);
  return res.json({ success: true, folders });
}));

router.post('/folders', verifyClerkToken, asyncHandler(async (req, res) => {
  const { name } = req.body as { name: string };
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ success: false, error: 'name is required' });
  }
  if (name.trim().length > 50) {
    return res.status(400).json({ success: false, error: 'Folder name too long (max 50 chars)' });
  }
  const folder = await folderService.createFolder(req.user!.id, name);
  return res.json({ success: true, folder });
}));

router.delete('/folders/:id', verifyClerkToken, asyncHandler(async (req, res) => {
  await folderService.deleteFolder(req.user!.id, String(req.params.id));
  return res.json({ success: true });
}));

export default router;
