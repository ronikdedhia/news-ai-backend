import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(), // Clerk user ID
    email: text('email').notNull().unique(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    profileImageUrl: text('profile_image_url'),
    isPremium: integer('is_premium').notNull().default(0),
    articlesViewedCount: integer('articles_viewed_count').notNull().default(0),
    lastLoginAt: text('last_login_at'),
    createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
    updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
  },
  (table) => ({
    emailIdx: index('users_email_key').on(table.email),
  })
);

export const articles = sqliteTable(
  'articles',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    content: text('content'),
    hashtags: text('hashtags'),
    url: text('url').notNull().unique(),
    imageUrl: text('image_url'),
    publishedAt: text('published_at').notNull(),
    bookmarkCount: integer('bookmark_count').notNull().default(0),
    upvoteCount: integer('upvote_count').notNull().default(0),
    downvoteCount: integer('downvote_count').notNull().default(0),
    sentiment: text('sentiment'),   // 'positive' | 'neutral' | 'negative'
    entities: text('entities'),     // JSON: [{name, type}]
    category: text('category'),
    whyItMatters: text('why_it_matters'),
    questions: text('questions'),     // JSON: [{q, a}]
    biasLabel: text('bias_label'),    // 'left' | 'center' | 'right'
    biasScore: integer('bias_score'), // confidence 0-100
  },
  (table) => ({
    urlIdx: index('articles_url_key').on(table.url),
    publishedAtIdx: index('articles_published_at_key').on(table.publishedAt),
    categoryIdx: index('articles_category_key').on(table.category),
    sentimentIdx: index('articles_sentiment_key').on(table.sentiment),
  })
);

export const userBookmarks = sqliteTable(
  'user_bookmarks',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    articleId: text('article_id').notNull(),
    folderId: text('folder_id'),
    createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  },
  (table) => ({
    userIdIdx: index('user_bookmarks_user_id_key').on(table.userId),
    articleIdIdx: index('user_bookmarks_article_id_key').on(table.articleId),
  })
);

export const articleHighlights = sqliteTable(
  'article_highlights',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    articleId: text('article_id').notNull(),
    text: text('text').notNull(),
    color: text('color').notNull().default('yellow'),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    userIdIdx:    index('article_highlights_user_id_key').on(table.userId),
    articleIdIdx: index('article_highlights_article_id_key').on(table.articleId),
  })
);

export const bookmarkFolders = sqliteTable(
  'bookmark_folders',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    userIdIdx: index('bookmark_folders_user_id_key').on(table.userId),
  })
);

export const articleComments = sqliteTable(
  'article_comments',
  {
    id: text('id').primaryKey(),
    articleId: text('article_id').notNull(),
    userId: text('user_id').notNull(),
    body: text('body').notNull(),
    parentId: text('parent_id'),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    articleIdIdx: index('article_comments_article_id_key').on(table.articleId),
    userIdIdx: index('article_comments_user_id_key').on(table.userId),
  })
);

export const userPreferences = sqliteTable(
  'user_preferences',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().unique(),
    preferredCategories: text('preferred_categories').notNull(), // JSON array
    preferredLanguage: text('preferred_language').notNull().default('english'),
    fontSize: text('font_size').notNull().default('medium'),
    theme: text('theme').notNull().default('light'),
    notificationsEnabled: integer('notifications_enabled').notNull().default(1),
    emailDigestFrequency: text('email_digest_frequency').notNull().default('daily'),
    createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
    updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
  },
  (table) => ({
    userIdIdx: index('user_preferences_user_id_key').on(table.userId),
  })
);

export const userStreaks = sqliteTable(
  'user_streaks',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().unique(),
    currentStreak: integer('current_streak').notNull().default(0),
    longestStreak: integer('longest_streak').notNull().default(0),
    lastArticleReadDate: text('last_article_read_date'),
    createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
    updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
  },
  (table) => ({
    userIdIdx: index('user_streaks_user_id_key').on(table.userId),
  })
);

export const articleReactions = sqliteTable(
  'article_reactions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    articleId: text('article_id').notNull(),
    type: text('type').notNull(), // 'upvote' | 'downvote'
    createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  },
  (table) => ({
    userArticleIdx: index('article_reactions_user_article_key').on(table.userId, table.articleId),
  })
);

export const userAlerts = sqliteTable(
  'user_alerts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    keyword: text('keyword').notNull(),
    isActive: integer('is_active').notNull().default(1),
    createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  },
  (table) => ({
    userIdIdx: index('user_alerts_user_id_key').on(table.userId),
  })
);

export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    alertId: text('alert_id').notNull(),
    articleId: text('article_id').notNull(),
    articleTitle: text('article_title').notNull(),
    articleUrl: text('article_url').notNull(),
    keyword: text('keyword').notNull(),
    read: integer('read').notNull().default(0),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    userIdIdx: index('notifications_user_id_key').on(table.userId),
    readIdx: index('notifications_read_key').on(table.read),
  })
);

export const userDismissals = sqliteTable(
  'user_dismissals',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    articleId: text('article_id').notNull(),
    createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  },
  (table) => ({
    userArticleIdx: index('user_dismissals_user_article_key').on(table.userId, table.articleId),
  })
);

export const pipelineRuns = sqliteTable(
  'pipeline_runs',
  {
    id: text('id').primaryKey(),
    source: text('source').notNull(), // 'newsdata' | 'alpha_vantage'
    status: text('status').notNull().default('running'), // 'running' | 'success' | 'failed'
    processed: integer('processed').notNull().default(0),
    saved: integer('saved').notNull().default(0),
    errors: integer('errors').notNull().default(0),
    telegramSent: integer('telegram_sent').notNull().default(0),
    startedAt: text('started_at').notNull(),
    completedAt: text('completed_at'),
    durationMs: integer('duration_ms'),
  },
  (table) => ({
    sourceIdx: index('pipeline_runs_source_key').on(table.source),
    startedAtIdx: index('pipeline_runs_started_at_key').on(table.startedAt),
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type UserBookmark = typeof userBookmarks.$inferSelect;
export type NewUserBookmark = typeof userBookmarks.$inferInsert;
export type UserPreference = typeof userPreferences.$inferSelect;
export type NewUserPreference = typeof userPreferences.$inferInsert;
export type UserStreak = typeof userStreaks.$inferSelect;
export type NewUserStreak = typeof userStreaks.$inferInsert;
export type ArticleReaction = typeof articleReactions.$inferSelect;
export type UserAlert = typeof userAlerts.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type PipelineRun = typeof pipelineRuns.$inferSelect;
export type UserDismissal = typeof userDismissals.$inferSelect;
export type BookmarkFolder = typeof bookmarkFolders.$inferSelect;
export type ArticleComment = typeof articleComments.$inferSelect;
export type ArticleHighlight = typeof articleHighlights.$inferSelect;
