'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { NewsCard } from '@/components/NewsCard'
import { Article, searchArticles } from '@/lib/api'

export default function SearchPage() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''
  
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState(query)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // If empty search, fetch all articles
    if (!searchQuery.trim()) {
      setLoading(true)
      setError(null)
      setArticles([])

      try {
        const { fetchArticles } = await import('@/lib/api')
        const result = await fetchArticles(50, 0)
        setArticles(result.articles)
      } catch (err: any) {
        setError(err.message || 'Failed to fetch articles')
      } finally {
        setLoading(false)
      }
      return
    }

    setLoading(true)
    setError(null)
    setArticles([])

    try {
      const result = await searchArticles(searchQuery)
      setArticles(result.articles)
      
      if (result.count === 0) {
        setError(`No articles found for "${searchQuery}"`)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to search articles')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (query) {
      setSearchQuery(query)
      handleSearch(new Event('submit') as any)
    } else {
      // If no query, load all articles
      setLoading(true)
      const loadAllArticles = async () => {
        try {
          const { fetchArticles } = await import('@/lib/api')
          const result = await fetchArticles(50, 0)
          setArticles(result.articles)
        } catch (err: any) {
          setError(err.message || 'Failed to fetch articles')
        } finally {
          setLoading(false)
        }
      }
      loadAllArticles()
    }
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Search Bar */}
        <div className="mb-8">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search articles by title or hashtags..."
              className="flex-1 px-4 py-2 border border-input rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary dark:bg-slate-900 dark:border-slate-700 dark:text-white"
            />
            <button
              type="submit"
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors dark:bg-primary dark:hover:bg-primary/80"
            >
              Search
            </button>
          </form>
        </div>

        {/* Results */}
        {loading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Searching...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <p className="text-red-500">{error}</p>
          </div>
        )}

        {articles.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery ? `Found ${articles.length} article${articles.length !== 1 ? 's' : ''} for "${searchQuery}"` : `Showing ${articles.length} articles`}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.map((article) => (
                <NewsCard key={article.id} article={article} />
              ))}
            </div>
          </div>
        )}

        {!loading && !error && articles.length === 0 && searchQuery && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No articles found. Try a different search.</p>
          </div>
        )}

        {!searchQuery && !loading && articles.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No articles available</p>
          </div>
        )}
      </div>
    </div>
  )
}
