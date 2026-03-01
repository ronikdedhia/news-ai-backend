'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { fetchTrendingNews, Article } from '@/lib/api'
import { NewsCard } from './NewsCard'
import { AlertCircle } from 'lucide-react'

export function NewsFeed() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const observerTarget = useRef<HTMLDivElement>(null)
  const hasInitialized = useRef(false)

  const LIMIT = 20

  const loadNews = useCallback(async (newOffset: number = 0) => {
    try {
      if (newOffset === 0) {
        setLoading(true)
      } else {
        setIsLoadingMore(true)
      }
      setError(null)
      const data = await fetchTrendingNews(LIMIT, newOffset)
      
      if (newOffset === 0) {
        setArticles(data.articles)
        setOffset(LIMIT)
      } else {
        setArticles(prev => [...prev, ...data.articles])
        setOffset(newOffset + LIMIT)
      }
      
      setHasMore(data.count === LIMIT)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load news')
      console.error('Error loading news:', err)
    } finally {
      setLoading(false)
      setIsLoadingMore(false)
    }
  }, [])

  // Initial load - only once
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true
      loadNews(0)
    }
  }, [loadNews])

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !loading) {
          loadNews(offset)
        }
      },
      { threshold: 0.1 }
    )

    if (observerTarget.current) {
      observer.observe(observerTarget.current)
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current)
      }
    }
  }, [offset, hasMore, isLoadingMore, loading, loadNews])

  if (loading && articles.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground">Loading latest news...</p>
        </div>
      </div>
    )
  }

  if (error && articles.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Failed to Load News</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
        </div>
      </div>
    )
  }

  if (articles.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">No articles found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Trending News</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles.map((article) => (
          <NewsCard key={article.id} article={article} />
        ))}
      </div>

      {/* Infinite scroll trigger */}
      <div ref={observerTarget} className="py-8 text-center">
        {isLoadingMore && (
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        )}
        {!hasMore && articles.length > 0 && (
          <p className="text-muted-foreground">No more articles to load</p>
        )}
      </div>
    </div>
  )
}
