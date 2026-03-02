import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export interface Article {
  id: string
  title: string
  url: string
  content: string
  publishedAt: string | Date
  imageUrl: string
  category?: string
  hashtags?: string
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
    const response = await apiClient.post(`/api/articles/${articleId}`, {
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
    const response = await apiClient.post(`/api/articles/${articleId}`, {
      action: 'unbookmark'
    })
    return response.data
  } catch (error) {
    console.error('Error removing bookmark:', error)
    throw error
  }
}

export const getUserBookmarks = async (limit: number = 20, offset: number = 0): Promise<{ bookmarks: Article[], count: number }> => {
  try {
    const response = await apiClient.get('/api/bookmarks', {
      params: { limit, offset }
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

export default apiClient
