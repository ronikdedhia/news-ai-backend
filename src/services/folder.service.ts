import { db } from '../db/client';
import { bookmarkFolders, userBookmarks } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

class FolderService {
  async getFolders(userId: string) {
    return db
      .select()
      .from(bookmarkFolders)
      .where(eq(bookmarkFolders.userId, userId));
  }

  async createFolder(userId: string, name: string) {
    const folder = {
      id: randomUUID(),
      userId,
      name: name.trim(),
      createdAt: new Date().toISOString(),
    };
    await db.insert(bookmarkFolders).values(folder);
    return folder;
  }

  async deleteFolder(userId: string, folderId: string) {
    await db
      .update(userBookmarks)
      .set({ folderId: null })
      .where(and(eq(userBookmarks.userId, userId), eq(userBookmarks.folderId, folderId)));
    await db
      .delete(bookmarkFolders)
      .where(and(eq(bookmarkFolders.id, folderId), eq(bookmarkFolders.userId, userId)));
  }

  async assignToFolder(userId: string, articleId: string, folderId: string | null) {
    await db
      .update(userBookmarks)
      .set({ folderId })
      .where(and(eq(userBookmarks.userId, userId), eq(userBookmarks.articleId, articleId)));
  }
}

export const folderService = new FolderService();
