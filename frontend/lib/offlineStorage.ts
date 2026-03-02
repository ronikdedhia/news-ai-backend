import { Article } from './api'

const STORAGE_KEY = 'news_articles_cache'
const TIMESTAMP_KEY = 'news_articles_timestamp'

export async function saveArticlesOffline(articles: Article[]): Promise<void> {
  try {
    // Save to localStorage as primary backup
    const articlesWithTimestamp = articles.map((article) => ({
      ...article,
      timestamp: Date.now(),
    }))
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(articlesWithTimestamp))
    localStorage.setItem(TIMESTAMP_KEY, new Date().toISOString())
    
    console.log('[Offline] Saved', articles.length, 'articles to localStorage')
  } catch (error) {
    console.error('[Offline] Error saving articles:', error)
  }
}

export async function getOfflineArticles(): Promise<Article[]> {
  try {
    const cached = localStorage.getItem(STORAGE_KEY)
    if (cached) {
      const articles = JSON.parse(cached)
      console.log('[Offline] Retrieved', articles.length, 'articles from localStorage')
      return articles.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0))
    }
    return []
  } catch (error) {
    console.error('[Offline] Error retrieving articles:', error)
    return []
  }
}

export async function getOfflineArticlesByCategory(category: string): Promise<Article[]> {
  try {
    const cached = localStorage.getItem(STORAGE_KEY)
    if (cached) {
      const articles = JSON.parse(cached)
      const filtered = articles.filter(
        (article: any) => article.category?.toLowerCase() === category.toLowerCase()
      )
      console.log('[Offline] Retrieved', filtered.length, 'articles in category:', category)
      return filtered.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0))
    }
    return []
  } catch (error) {
    console.error('[Offline] Error retrieving articles by category:', error)
    return []
  }
}

export async function clearOfflineArticles(): Promise<void> {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(TIMESTAMP_KEY)
    console.log('[Offline] Cleared cached articles')
  } catch (error) {
    console.error('[Offline] Error clearing articles:', error)
  }
}

export async function isOnline(): Promise<boolean> {
  return navigator.onLine
}
