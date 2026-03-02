import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export interface Article {
  id: string
  title: string
  url: string
  description: string
  content: string
  publishedAt: string | Date
  imageUrl: string
  sourceName: string
  sourceUrl: string
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

export default apiClient
