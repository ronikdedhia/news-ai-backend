import { db } from '../db/client';
import { articleComments, users } from '../db/schema';
import { eq, asc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

class CommentService {
  async getComments(articleId: string) {
    return db
      .select({
        id: articleComments.id,
        articleId: articleComments.articleId,
        userId: articleComments.userId,
        body: articleComments.body,
        parentId: articleComments.parentId,
        createdAt: articleComments.createdAt,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
        userImageUrl: users.profileImageUrl,
      })
      .from(articleComments)
      .leftJoin(users, eq(articleComments.userId, users.id))
      .where(eq(articleComments.articleId, articleId))
      .orderBy(asc(articleComments.createdAt));
  }

  async addComment(userId: string, articleId: string, body: string, parentId?: string) {
    const comment = {
      id: randomUUID(),
      articleId,
      userId,
      body: body.trim(),
      parentId: parentId || null,
      createdAt: new Date().toISOString(),
    };
    await db.insert(articleComments).values(comment);
    return comment;
  }

  async deleteComment(userId: string, commentId: string) {
    const existing = await db
      .select()
      .from(articleComments)
      .where(eq(articleComments.id, commentId))
      .limit(1);
    if (!existing[0]) throw new Error('Comment not found');
    if (existing[0].userId !== userId) throw new Error('Not authorized');
    // Also delete replies
    await db.delete(articleComments).where(eq(articleComments.parentId, commentId));
    await db.delete(articleComments).where(eq(articleComments.id, commentId));
  }
}

export const commentService = new CommentService();
