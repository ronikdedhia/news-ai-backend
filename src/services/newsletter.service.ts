import { db } from '../db/client';
import { users, userPreferences, articles, userStreaks } from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';
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
          and(
            // Match any of the preferred categories
            ...categories.map((cat: string) => eq(articles.category, cat))
          )
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
    const articlesHtml = articlesList
      .map(
        (article, index) => `
      <div style="margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #e0e0e0;">
        <h3 style="margin: 0 0 10px 0; color: #1a1a1a; font-size: 18px; line-height: 1.4;">
          ${index + 1}. ${article.title}
        </h3>
        ${article.imageUrl ? `<img src="${article.imageUrl}" alt="Article image" style="max-width: 100%; height: auto; margin: 15px 0; border-radius: 8px;">` : ''}
        <p style="margin: 10px 0; color: #666; font-size: 14px; line-height: 1.6;">
          ${article.content ? article.content : 'No preview available'}
        </p>
        <a href="${article.url}" style="display: inline-block; margin-top: 10px; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-size: 14px;">
          Read Full Article →
        </a>
        ${article.category ? `<span style="display: inline-block; margin-left: 10px; padding: 5px 10px; background-color: #f0f0f0; color: #666; border-radius: 3px; font-size: 12px;">${this.toSentenceCase(article.category)}</span>` : ''}
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
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px; text-align: center; margin-bottom: 30px; }
          .header h1 { margin: 0; font-size: 28px; }
          .header p { margin: 10px 0 0 0; font-size: 14px; opacity: 0.9; }
          .content { background: white; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #999; }
          a { color: #007bff; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📰 Your Daily News Digest</h1>
            <p>Curated just for you, ${userFirstName}</p>
          </div>
          
          <div class="content">
            <p style="font-size: 16px; margin-bottom: 20px;">
              Hi ${userFirstName},
            </p>
            <p style="color: #666; margin-bottom: 20px;">
              Here are today's top stories tailored to your interests. Click on any article to read the full story.
            </p>

            ${stats ? `
            <div style="display:flex;gap:12px;margin-bottom:28px;flex-wrap:wrap;">
              <div style="flex:1;min-width:120px;background:#f9f9ff;border:1px solid #e0e0ff;border-radius:8px;padding:14px;text-align:center;">
                <div style="font-size:24px;">🔥</div>
                <div style="font-size:22px;font-weight:700;color:#667eea;">${stats.currentStreak}</div>
                <div style="font-size:12px;color:#888;">day streak</div>
              </div>
              <div style="flex:1;min-width:120px;background:#f9f9ff;border:1px solid #e0e0ff;border-radius:8px;padding:14px;text-align:center;">
                <div style="font-size:24px;">🏆</div>
                <div style="font-size:22px;font-weight:700;color:#667eea;">${stats.longestStreak}</div>
                <div style="font-size:12px;color:#888;">best streak</div>
              </div>
              <div style="flex:1;min-width:120px;background:#f9f9ff;border:1px solid #e0e0ff;border-radius:8px;padding:14px;text-align:center;">
                <div style="font-size:24px;">📖</div>
                <div style="font-size:22px;font-weight:700;color:#667eea;">${stats.articlesViewed}</div>
                <div style="font-size:12px;color:#888;">articles read</div>
              </div>
            </div>` : ''}

            ${articlesHtml}
            
            <!-- Commented out - website not deployed yet
            <div style="margin-top: 40px; padding: 20px; background-color: #f9f9f9; border-radius: 8px; text-align: center;">
              <p style="margin: 0; color: #666; font-size: 14px;">
                <a href="${process.env.FRONTEND_URL || 'https://newsai.com'}" style="color: #007bff; text-decoration: none;">
                  View all articles on NewsAI →
                </a>
              </p>
            </div>
            -->
          </div>
          
          <div class="footer">
            <p>You're receiving this because you subscribed to the Daily Bytes AI newsletter.</p>
            <p>
              <a href="${process.env.FRONTEND_URL || 'https://newsai.com'}/newsletter-preferences" style="color: #999;">Manage preferences</a> | 
              <a href="${process.env.FRONTEND_URL || 'https://newsai.com'}/unsubscribe" style="color: #999;">Unsubscribe</a>
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
        subject: `📰 Your Daily News Digest - ${new Date().toLocaleDateString()}`,
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
