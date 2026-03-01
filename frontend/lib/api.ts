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
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

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

export default apiClient
