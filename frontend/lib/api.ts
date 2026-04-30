import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export interface Entity {
  name: string
  type: 'person' | 'company' | 'place'
}

export interface Article {
  id: string
  title: string
  url: string
  content: string
  publishedAt: string | Date
  imageUrl: string
  category?: string
  hashtags?: string
  upvoteCount?: number
  downvoteCount?: number
  userReaction?: 'upvote' | 'downvote' | null
  sentiment?: 'positive' | 'neutral' | 'negative' | null
  entities?: string | null  // JSON string from DB
  bookmarkFolderId?: string | null
  whyItMatters?: string | null
  questions?: string | null   // JSON: [{q, a}]
  biasLabel?: 'left' | 'center' | 'right' | null
  biasScore?: number | null
  _rankReason?: {
    categoryMatch: boolean
    hashtagMatches: number
    hoursOld: number
    score: number
  }
}

export interface DashboardMetrics {
  totals: {
    articles: number
    users: number
    upvotes: number
    activeAlerts: number
  }
  categoryBreakdown: Array<{ category: string | null; count: number }>
  sentimentBreakdown: Array<{ sentiment: string | null; count: number }>
  recentRuns: Array<{
    id: string
    source: string
    status: string
    processed: number
    saved: number
    errors: number
    telegramSent: number
    startedAt: string
    completedAt: string | null
    durationMs: number | null
  }>
  topArticles: Array<{ id: string; title: string; upvoteCount: number; category: string | null }>
  pipelineSuccessRate: number
}

export interface SimilarArticle {
  id: string
  title: string
  url: string
  imageUrl: string | null
  category: string | null
}

export interface Comment {
  id: string
  articleId: string
  userId: string
  body: string
  parentId: string | null
  createdAt: string
  userFirstName: string | null
  userLastName: string | null
  userEmail: string | null
  userImageUrl: string | null
}

export interface Highlight {
  id: string
  userId: string
  articleId: string
  text: string
  color: string
  createdAt: string
}

export interface BookmarkFolder {
  id: string
  userId: string
  name: string
  createdAt: string
}

export interface UserAlert {
  id: string
  userId: string
  keyword: string
  isActive: number
  createdAt: string
}

export interface AppNotification {
  id: string
  userId: string
  alertId: string
  articleId: string
  articleTitle: string
  articleUrl: string
  keyword: string
  read: number
  createdAt: string
}

export interface FetchNewsResponse {
  success: boolean
  count: number
  articles: Article[]
  tier?: 'free' | 'premium'
  totalAvailable?: number
  requiresAuth?: boolean
}

export interface User {
  id: string
  email: string
  firstName?: string
  lastName?: string
  isPremium: boolean
  articlesViewedCount: number
  createdAt?: string
}

export interface UserPreferences {
  id: string
  userId: string
  preferredCategories: string[]
  preferredLanguage: 'english' | 'hindi' | 'marathi' | 'gujarati' | 'tamil' | 'spanish' | 'french' | 'german'
  fontSize: 'small' | 'medium' | 'large'
  theme: 'light' | 'dark'
  notificationsEnabled: boolean
  emailDigestFrequency: 'daily' | 'weekly' | 'never'
  createdAt: string
  updatedAt: string
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

export const fetchArticles = async (limit: number = 10, offset: number = 0): Promise<{ articles: Article[], count: number, tier: string, requiresAuth?: boolean }> => {
  try {
    const response = await apiClient.get<FetchNewsResponse>('/api/articles', {
      params: { limit, offset }
    })
    
    if (response.data.requiresAuth) {
      return {
        articles: [],
        count: 0,
        tier: 'free',
        requiresAuth: true
      }
    }
    
    if (response.data.success) {
      return {
        articles: response.data.articles,
        count: response.data.count,
        tier: response.data.tier || 'free'
      }
    }
    throw new Error('Failed to fetch articles')
  } catch (error: any) {
    if (error.response?.status === 403 && error.response?.data?.requiresAuth) {
      return {
        articles: [],
        count: 0,
        tier: 'free',
        requiresAuth: true
      }
    }
    console.error('Error fetching articles:', error)
    throw error
  }
}

export const fetchTrendingNews = async (limit: number = 20, offset: number = 0): Promise<{ articles: Article[], count: number }> => {
  try {
    const response = await apiClient.get<FetchNewsResponse>('/api/articles/trending', {
      params: { limit, offset }
    })
    if (response.data.success) {
      return {
        articles: response.data.articles,
        count: response.data.count
      }
    }
    throw new Error('Failed to fetch trending news')
  } catch (error) {
    console.error('Error fetching trending news:', error)
    throw error
  }
}

export const syncUser = async (userData: { email: string; firstName?: string; lastName?: string }): Promise<User> => {
  try {
    const response = await apiClient.post('/api/auth/sync-user', userData)
    return response.data.user
  } catch (error) {
    console.error('Error syncing user:', error)
    throw error
  }
}

export const getCurrentUser = async (): Promise<User> => {
  try {
    const response = await apiClient.get('/api/auth/me')
    return response.data.user
  } catch (error) {
    console.error('Error fetching current user:', error)
    throw error
  }
}

export const createUserPreferences = async (preferences: {
  preferredCategories: string[]
  preferredLanguage: string
  fontSize: string
  theme: string
  notificationsEnabled: boolean
  emailDigestFrequency: string
}): Promise<UserPreferences> => {
  try {
    const response = await apiClient.post('/api/auth/preferences', preferences)
    return response.data.preferences
  } catch (error) {
    console.error('Error creating user preferences:', error)
    throw error
  }
}

export const getUserPreferences = async (): Promise<UserPreferences> => {
  try {
    const response = await apiClient.get('/api/auth/preferences')
    return response.data.preferences
  } catch (error) {
    console.error('Error fetching user preferences:', error)
    throw error
  }
}

export const updateUserPreferences = async (preferences: Partial<{
  preferredCategories: string[]
  preferredLanguage: string
  fontSize: string
  theme: string
  notificationsEnabled: boolean
  emailDigestFrequency: string
}>): Promise<UserPreferences> => {
  try {
    const response = await apiClient.put('/api/auth/preferences', preferences)
    return response.data.preferences
  } catch (error) {
    console.error('Error updating user preferences:', error)
    throw error
  }
}

export const addBookmark = async (articleId: string): Promise<{ success: boolean }> => {
  try {
    const response = await apiClient.post(`/api/articles/${encodeURIComponent(articleId)}`, {
      action: 'bookmark'
    })
    return response.data
  } catch (error) {
    console.error('Error adding bookmark:', error)
    throw error
  }
}

export const removeBookmark = async (articleId: string): Promise<{ success: boolean }> => {
  try {
    const response = await apiClient.post(`/api/articles/${encodeURIComponent(articleId)}`, {
      action: 'unbookmark'
    })
    return response.data
  } catch (error) {
    console.error('Error removing bookmark:', error)
    throw error
  }
}

export const getUserBookmarks = async (limit: number = 20, offset: number = 0, folderId?: string): Promise<{ bookmarks: Article[], count: number }> => {
  try {
    const response = await apiClient.get('/api/bookmarks', {
      params: { limit, offset, ...(folderId ? { folderId } : {}) }
    })
    return {
      bookmarks: response.data.bookmarks,
      count: response.data.count
    }
  } catch (error) {
    console.error('Error fetching user bookmarks:', error)
    throw error
  }
}

export const searchArticles = async (query: string, limit: number = 20, offset: number = 0): Promise<{ articles: Article[], count: number, query: string }> => {
  try {
    const response = await apiClient.get('/api/search', {
      params: { q: query, limit, offset }
    })
    if (response.data.success) {
      return {
        articles: response.data.articles,
        count: response.data.count,
        query: response.data.query
      }
    }
    throw new Error('Failed to search articles')
  } catch (error) {
    console.error('Error searching articles:', error)
    throw error
  }
}

export const getUserStreak = async (): Promise<{ currentStreak: number, longestStreak: number, lastArticleReadDate: string | null, badges: string[] }> => {
  try {
    const response = await apiClient.get('/api/auth/streak')
    return response.data.streak
  } catch (error) {
    console.error('Error fetching user streak:', error)
    throw error
  }
}

export const fetchPersonalizedArticles = async (): Promise<{ articles: Article[]; count: number }> => {
  try {
    const response = await apiClient.get('/api/articles/personalized')
    return { articles: response.data.articles, count: response.data.count }
  } catch (error) {
    console.error('Error fetching personalized articles:', error)
    throw error
  }
}

export const getDashboardMetrics = async (): Promise<DashboardMetrics> => {
  try {
    const response = await apiClient.get('/api/metrics')
    return response.data.metrics
  } catch (error) {
    console.error('Error fetching metrics:', error)
    throw error
  }
}

export const reactToArticle = async (articleId: string, type: 'upvote' | 'downvote'): Promise<{ reaction: 'upvote' | 'downvote' | null }> => {
  try {
    const response = await apiClient.post(`/api/articles/${encodeURIComponent(articleId)}/react`, { type })
    return response.data
  } catch (error) {
    console.error('Error reacting to article:', error)
    throw error
  }
}

export const getSimilarArticles = async (articleId: string): Promise<SimilarArticle[]> => {
  try {
    const response = await apiClient.get(`/api/articles/${encodeURIComponent(articleId)}/similar`)
    return response.data.articles
  } catch (error) {
    console.error('Error fetching similar articles:', error)
    return []
  }
}

export const getAlerts = async (): Promise<UserAlert[]> => {
  try {
    const response = await apiClient.get('/api/auth/alerts')
    return response.data.alerts
  } catch (error) {
    console.error('Error fetching alerts:', error)
    throw error
  }
}

export const createAlert = async (keyword: string): Promise<UserAlert> => {
  try {
    const response = await apiClient.post('/api/auth/alerts', { keyword })
    return response.data.alert
  } catch (error) {
    console.error('Error creating alert:', error)
    throw error
  }
}

export const deleteAlert = async (alertId: string): Promise<void> => {
  try {
    await apiClient.delete(`/api/auth/alerts/${alertId}`)
  } catch (error) {
    console.error('Error deleting alert:', error)
    throw error
  }
}

export const getNotifications = async (): Promise<AppNotification[]> => {
  try {
    const response = await apiClient.get('/api/notifications')
    return response.data.notifications
  } catch (error) {
    console.error('Error fetching notifications:', error)
    throw error
  }
}

export const getUnreadNotificationCount = async (): Promise<number> => {
  try {
    const response = await apiClient.get('/api/notifications/unread-count')
    return response.data.count
  } catch (error) {
    return 0
  }
}

export const markAllNotificationsRead = async (): Promise<void> => {
  await apiClient.post('/api/notifications/read-all')
}

export const markNotificationRead = async (id: string): Promise<void> => {
  await apiClient.post(`/api/notifications/${id}/read`)
}

export const deleteNotification = async (id: string): Promise<void> => {
  await apiClient.delete(`/api/notifications/${id}`)
}

// ── Trending Hashtags ─────────────────────────────────────────────────────────

export const getTrendingHashtags = async (hours = 48): Promise<{ tag: string; count: number }[]> => {
  try {
    const response = await apiClient.get('/api/trending-hashtags', { params: { hours } })
    return response.data.trending
  } catch (error) {
    console.error('Error fetching trending hashtags:', error)
    return []
  }
}

// ── Comments ──────────────────────────────────────────────────────────────────

export const getComments = async (articleId: string): Promise<Comment[]> => {
  try {
    const response = await apiClient.get(`/api/articles/${encodeURIComponent(articleId)}/comments`)
    return response.data.comments
  } catch (error) {
    console.error('Error fetching comments:', error)
    return []
  }
}

export const addComment = async (articleId: string, body: string, parentId?: string): Promise<Comment> => {
  const response = await apiClient.post(`/api/articles/${encodeURIComponent(articleId)}/comments`, { body, parentId })
  return response.data.comment
}

export const deleteComment = async (articleId: string, commentId: string): Promise<void> => {
  await apiClient.delete(`/api/articles/${encodeURIComponent(articleId)}/comments/${commentId}`)
}

// ── Bookmark Folders ──────────────────────────────────────────────────────────

export const getFolders = async (): Promise<BookmarkFolder[]> => {
  try {
    const response = await apiClient.get('/api/folders')
    return response.data.folders
  } catch (error) {
    console.error('Error fetching folders:', error)
    return []
  }
}

export const createFolder = async (name: string): Promise<BookmarkFolder> => {
  const response = await apiClient.post('/api/folders', { name })
  return response.data.folder
}

export const deleteFolder = async (id: string): Promise<void> => {
  await apiClient.delete(`/api/folders/${id}`)
}

export const assignToFolder = async (articleId: string, folderId: string | null): Promise<void> => {
  await apiClient.put(`/api/bookmarks/${encodeURIComponent(articleId)}/folder`, { folderId })
}

// ── Highlights ────────────────────────────────────────────────────────────────

export const getHighlights = async (articleId: string): Promise<Highlight[]> => {
  try {
    const response = await apiClient.get(`/api/articles/${encodeURIComponent(articleId)}/highlights`)
    return response.data.highlights
  } catch { return [] }
}

export const addHighlight = async (articleId: string, text: string, color: string): Promise<Highlight> => {
  const response = await apiClient.post(`/api/articles/${encodeURIComponent(articleId)}/highlights`, { text, color })
  return response.data.highlight
}

export const deleteHighlight = async (articleId: string, highlightId: string): Promise<void> => {
  await apiClient.delete(`/api/articles/${encodeURIComponent(articleId)}/highlights/${highlightId}`)
}

// ── Why It Matters ────────────────────────────────────────────────────────────

export const fetchWhyItMatters = async (articleId: string): Promise<string | null> => {
  try {
    const response = await apiClient.get(`/api/articles/${encodeURIComponent(articleId)}/why-it-matters`)
    return response.data.whyItMatters
  } catch { return null }
}

export const fetchQuestions = async (articleId: string): Promise<Array<{ q: string; a: string }>> => {
  try {
    const response = await apiClient.get(`/api/articles/${encodeURIComponent(articleId)}/questions`)
    return response.data.questions || []
  } catch { return [] }
}

// ── Dismiss ───────────────────────────────────────────────────────────────────

export const dismissArticle = async (articleId: string): Promise<void> => {
  await apiClient.post(`/api/articles/${encodeURIComponent(articleId)}/dismiss`)
}

// ── Weekly Wrap ───────────────────────────────────────────────────────────────

export interface WeeklyWrap {
  articlesViewed: number
  streak: number
  topCategory: string | null
  topHashtag: string | null
  reactionsThisWeek: number
  bookmarksThisWeek: number
  firstName: string | null
}

export const getWeeklyWrap = async (): Promise<WeeklyWrap> => {
  const response = await apiClient.get('/api/auth/weekly-wrap')
  return response.data.wrap
}

// ── Catch-Up Brief ────────────────────────────────────────────────────────────

export interface CatchUpBriefResponse {
  shouldShow: boolean
  count?: number
  summary?: string
  since?: string
  hoursAway?: number
}

export const getCatchUpBrief = async (): Promise<CatchUpBriefResponse> => {
  const response = await apiClient.get('/api/auth/catchup-brief')
  return response.data
}

export default apiClient
