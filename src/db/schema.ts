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
    category: text('category'),
  },
  (table) => ({
    urlIdx: index('articles_url_key').on(table.url),
    publishedAtIdx: index('articles_published_at_key').on(table.publishedAt),
    categoryIdx: index('articles_category_key').on(table.category),
  })
);

export const userBookmarks = sqliteTable(
  'user_bookmarks',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    articleId: text('article_id').notNull(),
    createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  },
  (table) => ({
    userIdIdx: index('user_bookmarks_user_id_key').on(table.userId),
    articleIdIdx: index('user_bookmarks_article_id_key').on(table.articleId),
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type UserBookmark = typeof userBookmarks.$inferSelect;
export type NewUserBookmark = typeof userBookmarks.$inferInsert;
