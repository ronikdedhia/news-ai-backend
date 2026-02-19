import { pgTable, text, uuid, integer, timestamp, index } from 'drizzle-orm/pg-core';

export const articles = pgTable(
  'articles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    // title: text('summarized_title'),
    content: text('content'),
    url: text('url').notNull().unique(),
    imageUrl: text('image_url'),
    publishedAt: timestamp('published_at').notNull().defaultNow(),
    bookmarkCount: integer('bookmark_count').notNull().default(0),
  },
  (table) => ({
    urlIdx: index('articles_url_key').on(table.url),
    publishedAtIdx: index('articles_published_at_key').on(table.publishedAt),
  })
);

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
