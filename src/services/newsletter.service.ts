import { db } from '../db/client';
import { users, userPreferences, articles, userStreaks } from '../db/schema';
import { eq, desc, and, or } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { brevoService } from './brevo.service';
import { articleService } from './article.service';

interface NewsletterArticle {
  title: string;
  content: string | null;
  url: string;
  imageUrl: string | null;
  category: string | null;
}

class NewsletterService {
  /**
   * Get articles for newsletter based on user preferences
   */
  private async getArticlesForUser(userId: string, limit: number = 5): Promise<NewsletterArticle[]> {
    try {
      // Get user preferences
      const prefs = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      if (!prefs || prefs.length === 0) {
        // If no preferences, return latest articles
        return this.getLatestArticles(limit);
      }

      const preference = prefs[0];
      const categories = JSON.parse(preference.preferredCategories || '[]');

      if (categories.length === 0) {
        return this.getLatestArticles(limit);
      }

      // Get articles from preferred categories
      const categoryArticles = await db
        .select({
          title: articles.title,
          content: articles.content,
          url: articles.url,
          imageUrl: articles.imageUrl,
          category: articles.category,
        })
        .from(articles)
        .where(
          or(...categories.map((cat: string) => eq(articles.category, cat)))
        )
        .orderBy(desc(articles.publishedAt))
        .limit(limit);

      return categoryArticles.length > 0 ? categoryArticles : this.getLatestArticles(limit);
    } catch (error: any) {
      logger.error(`Error fetching articles for user ${userId}: ${error.message}`);
      return this.getLatestArticles(limit);
    }
  }

  /**
   * Get latest articles
   */
  private async getLatestArticles(limit: number = 5): Promise<NewsletterArticle[]> {
    return db
      .select({
        title: articles.title,
        content: articles.content,
        url: articles.url,
        imageUrl: articles.imageUrl,
        category: articles.category,
      })
      .from(articles)
      .orderBy(desc(articles.publishedAt))
      .limit(limit);
  }

  /**
   * Convert category to sentence case
   */
  private toSentenceCase(text: string): string {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  }

  private async getUserStats(userId: string): Promise<{ currentStreak: number; longestStreak: number; articlesViewed: number }> {
    const [streakRow, userRow] = await Promise.all([
      db.select({ currentStreak: userStreaks.currentStreak, longestStreak: userStreaks.longestStreak })
        .from(userStreaks).where(eq(userStreaks.userId, userId)).limit(1),
      db.select({ articlesViewedCount: users.articlesViewedCount })
        .from(users).where(eq(users.id, userId)).limit(1),
    ]);

    return {
      currentStreak: streakRow[0]?.currentStreak ?? 0,
      longestStreak: streakRow[0]?.longestStreak ?? 0,
      articlesViewed: userRow[0]?.articlesViewedCount ?? 0,
    };
  }

  /**
   * Build HTML email template
   */
  private buildEmailTemplate(userFirstName: string, articlesList: NewsletterArticle[], stats?: { currentStreak: number; longestStreak: number; articlesViewed: number }): string {
    const now = new Date();
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
    const formattedDate = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const articlesHtml = articlesList
      .map(
        (article, index) => `
      <div style="margin-bottom: 28px; padding-bottom: 28px; border-bottom: 1px solid #f0f0f0;">
        ${article.imageUrl ? `<img src="${article.imageUrl}" alt="" style="width:100%;height:200px;object-fit:cover;border-radius:10px;margin-bottom:14px;display:block;">` : ''}
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="font-size:12px;font-weight:700;color:#8b5cf6;letter-spacing:1px;text-transform:uppercase;">${index + 1 < 10 ? '0' + (index + 1) : index + 1}</span>
          ${article.category ? `<span style="font-size:11px;font-weight:600;color:#fff;background:linear-gradient(135deg,#667eea,#764ba2);padding:3px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:0.5px;">${this.toSentenceCase(article.category)}</span>` : ''}
        </div>
        <h3 style="margin:0 0 10px 0;color:#0d1117;font-size:19px;font-weight:700;line-height:1.4;">
          ${article.title}
        </h3>
        <p style="margin:0 0 14px 0;color:#57606a;font-size:14px;line-height:1.7;">
          ${article.content ? article.content : 'No preview available.'}
        </p>
        <a href="${article.url}" style="display:inline-block;padding:9px 20px;background:#0d1117;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;letter-spacing:0.3px;">
          Read full story →
        </a>
      </div>
    `
      )
      .join('');

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;background:#f6f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
        <div style="max-width:600px;margin:32px auto;padding:0 16px 40px;">

          <!-- Masthead -->
          <div style="background:#0d1117;border-radius:14px 14px 0 0;padding:36px 32px 24px;text-align:center;">
            <div style="font-size:11px;letter-spacing:5px;color:#8b949e;text-transform:uppercase;margin-bottom:14px;">AI-Powered News Intelligence</div>
            <div style="font-size:46px;font-weight:900;color:#ffffff;letter-spacing:-1.5px;line-height:1;font-family:Georgia,serif;">Daily Bytes</div>
            <div style="height:2px;background:linear-gradient(90deg,transparent,#667eea,#764ba2,#667eea,transparent);margin:18px auto;max-width:280px;"></div>
            <div style="font-size:18px;color:#c9d1d9;font-style:italic;margin-bottom:6px;">${dayName}'s Intelligence Brief</div>
            <div style="font-size:12px;color:#8b949e;">${formattedDate} &nbsp;·&nbsp; Curated for ${userFirstName}</div>
          </div>

          <!-- Accent bar -->
          <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);height:5px;margin-bottom:28px;border-radius:0 0 4px 4px;"></div>

          <!-- Body -->
          <div style="background:#ffffff;border-radius:12px;padding:28px 32px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">

            <p style="font-size:16px;color:#24292f;margin:0 0 6px 0;">Hi <strong>${userFirstName}</strong>,</p>
            <p style="color:#57606a;font-size:14px;margin:0 0 24px 0;">Here are today's top stories curated to your interests. Click any article to read the full story.</p>

            ${stats ? `
            <div style="display:flex;gap:12px;margin-bottom:28px;flex-wrap:wrap;">
              <div style="flex:1;min-width:110px;background:#f9f9ff;border:1px solid #e0e0ff;border-radius:10px;padding:14px;text-align:center;">
                <div style="font-size:22px;margin-bottom:4px;">🔥</div>
                <div style="font-size:24px;font-weight:800;color:#667eea;line-height:1;">${stats.currentStreak}</div>
                <div style="font-size:11px;color:#8b949e;margin-top:3px;text-transform:uppercase;letter-spacing:0.5px;">day streak</div>
              </div>
              <div style="flex:1;min-width:110px;background:#f9f9ff;border:1px solid #e0e0ff;border-radius:10px;padding:14px;text-align:center;">
                <div style="font-size:22px;margin-bottom:4px;">🏆</div>
                <div style="font-size:24px;font-weight:800;color:#667eea;line-height:1;">${stats.longestStreak}</div>
                <div style="font-size:11px;color:#8b949e;margin-top:3px;text-transform:uppercase;letter-spacing:0.5px;">best streak</div>
              </div>
              <div style="flex:1;min-width:110px;background:#f9f9ff;border:1px solid #e0e0ff;border-radius:10px;padding:14px;text-align:center;">
                <div style="font-size:22px;margin-bottom:4px;">📖</div>
                <div style="font-size:24px;font-weight:800;color:#667eea;line-height:1;">${stats.articlesViewed}</div>
                <div style="font-size:11px;color:#8b949e;margin-top:3px;text-transform:uppercase;letter-spacing:0.5px;">articles read</div>
              </div>
            </div>` : ''}

            <div style="height:1px;background:#f0f0f0;margin-bottom:28px;"></div>

            ${articlesHtml}
          </div>

          <!-- Footer -->
          <div style="text-align:center;margin-top:24px;font-size:12px;color:#8b949e;line-height:1.8;">
            <p style="margin:0 0 4px 0;">You're receiving this because you subscribed to <strong>Daily Bytes</strong>.</p>
            <p style="margin:0;">
              <a href="${process.env.FRONTEND_URL || '#'}/newsletter-preferences" style="color:#8b949e;">Manage preferences</a>
              &nbsp;·&nbsp;
              <a href="${process.env.FRONTEND_URL || '#'}/unsubscribe" style="color:#8b949e;">Unsubscribe</a>
            </p>
          </div>

        </div>
      </body>
    </html>
    `;
  }

  /**
   * Send newsletter to a single user
   */
  async sendNewsletterToUser(userId: string): Promise<boolean> {
    try {
      // Get user
      const userList = await db.select().from(users).where(eq(users.id, userId)).limit(1);

      if (!userList || userList.length === 0) {
        logger.warn(`User not found: ${userId}`);
        return false;
      }

      const user = userList[0];

      // Get articles for user
      const articlesList = await this.getArticlesForUser(userId, parseInt(process.env.NEWSLETTER_ARTICLES_COUNT || '5'));

      if (articlesList.length === 0) {
        logger.warn(`No articles found for newsletter to ${user.email}`);
        return false;
      }

      // Build email
      const stats = await this.getUserStats(userId);
      const html = this.buildEmailTemplate(user.firstName || 'there', articlesList, stats);

      // Send email
      const sent = await brevoService.sendEmail({
        to: user.email,
        subject: `☀️ Your ${new Date().toLocaleDateString('en-US', { weekday: 'long' })} Brief is here — Daily Bytes`,
        html,
      });

      return sent;
    } catch (error: any) {
      logger.error(`Error sending newsletter to user ${userId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Send newsletter to all users with notifications enabled
   */
  async sendNewsletterToAll(): Promise<{ sent: number; failed: number }> {
    try {
      logger.info('📧 Starting daily newsletter send...');

      // Get all users with notifications enabled
      const allUsers = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
        })
        .from(users);

      if (allUsers.length === 0) {
        logger.warn('No users found for newsletter');
        return { sent: 0, failed: 0 };
      }

      let sent = 0;
      let failed = 0;

      // Send to each user
      for (const user of allUsers) {
        const success = await this.sendNewsletterToUser(user.id);
        if (success) {
          sent++;
        } else {
          failed++;
        }
      }

      logger.info(`✅ Newsletter send complete: ${sent} sent, ${failed} failed`);
      return { sent, failed };
    } catch (error: any) {
      logger.error(`Error sending newsletter to all users: ${error.message}`);
      return { sent: 0, failed: 0 };
    }
  }
}

export const newsletterService = new NewsletterService();
