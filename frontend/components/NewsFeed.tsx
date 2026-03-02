'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'
import { useApiClient } from '@/lib/useApiClient'
import { fetchArticles, Article, syncUser } from '@/lib/api'
import { NewsCard } from './NewsCard'
import { CategoryFilter } from './CategoryFilter'
import { AlertCircle, Lock } from 'lucide-react'
import { Button } from './ui/button'

export function NewsFeed() {
  const { isSignedIn } = useAuth()
  const { user: clerkUser } = useUser()
  useApiClient()
  
  const [articles, setArticles] = useState<(Article & { isBookmarked?: boolean })[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [tier, setTier] = useState<'free' | 'premium'>('free')
  const [requiresAuth, setRequiresAuth] = useState(false)
  const observerTarget = useRef<HTMLDivElement>(null)
  const hasInitialized = useRef(false)

  const FREE_TIER_LIMIT = 10
  const LIMIT = isSignedIn ? 20 : 10

  const loadNews = useCallback(async (newOffset: number = 0) => {
    if (!isSignedIn && newOffset >= FREE_TIER_LIMIT) {
      setRequiresAuth(true)
      setHasMore(false)
      return
    }

    try {
      if (newOffset === 0) {
        setLoading(true)
      } else {
        setIsLoadingMore(true)
      }
      setError(null)
      
      const data = await fetchArticles(LIMIT, newOffset)
      
      if (data.requiresAuth) {
        setRequiresAuth(true)
        setHasMore(false)
        return
      }

      setRequiresAuth(false)
      setTier(data.tier as 'free' | 'premium')
      
      if (newOffset === 0) {
        setArticles(data.articles)
        if (!isSignedIn && data.articles.length >= FREE_TIER_LIMIT) {
          setOffset(FREE_TIER_LIMIT)
          setHasMore(false)
          setRequiresAuth(true)
        } else {
          setOffset(newOffset + LIMIT)
          setHasMore(data.count === LIMIT)
        }
      } else {
        const newArticles = [...articles, ...data.articles]
        if (!isSignedIn && newArticles.length >= FREE_TIER_LIMIT) {
          setArticles(newArticles.slice(0, FREE_TIER_LIMIT))
          setOffset(FREE_TIER_LIMIT)
          setHasMore(false)
          setRequiresAuth(true)
        } else {
          setArticles(newArticles)
          setOffset(newOffset + LIMIT)
          setHasMore(data.count === LIMIT)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load news')
      console.error('Error loading news:', err)
      setHasMore(false)
    } finally {
      setLoading(false)
      setIsLoadingMore(false)
    }
  }, [isSignedIn, articles, LIMIT])

  useEffect(() => {
    if (isSignedIn && clerkUser) {
      syncUser({
        email: clerkUser.emailAddresses[0]?.emailAddress || '',
        firstName: clerkUser.firstName || undefined,
        lastName: clerkUser.lastName || undefined,
      }).catch(err => console.error('Error syncing user:', err))
    } else if (!isSignedIn) {
      setTier('free')
    }
  }, [isSignedIn, clerkUser])

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true
      loadNews(0)
    }
  }, [loadNews])

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !loading) {
          if (!isSignedIn && offset >= FREE_TIER_LIMIT) {
            setRequiresAuth(true)
            setHasMore(false)
            return
          }
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
  }, [offset, hasMore, isLoadingMore, loading, isSignedIn, loadNews])

  const handleBookmarkChange = (articleId: string, isBookmarked: boolean) => {
    setArticles(prev => prev.map(article => 
      article.id === articleId ? { ...article, isBookmarked } : article
    ))
  }

  // Filter articles by selected category
  const filteredArticles = selectedCategory
    ? selectedCategory === 'others'
      ? articles.filter(article => !article.category || article.category.trim() === '')
      : articles.filter(article => article.category?.toLowerCase() === selectedCategory.toLowerCase())
    : articles

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

  const handleCategoryChange = (category: string | null) => {
    setSelectedCategory(category)
    setError(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Latest News</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {tier === 'premium' ? '✨ Unlimited Access' : '📰 Free Tier (10 articles)'}
          </p>
        </div>
      </div>

      {/* Category Filter */}
      <CategoryFilter selectedCategory={selectedCategory} onCategoryChange={handleCategoryChange} />

      {/* Search Bar */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search articles by title or hashtags..."
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              const query = (e.target as HTMLInputElement).value
              if (query.trim()) {
                window.location.href = `/search?q=${encodeURIComponent(query)}`
              }
            }
          }}
          className="flex-1 px-4 py-2 border border-input rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary dark:bg-slate-900 dark:border-slate-700 dark:text-white"
        />
      </div>

      {/* Articles Grid with Animation */}
      {filteredArticles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          {filteredArticles.map((article) => (
            <div key={article.id} className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <NewsCard 
                article={article}
                onBookmarkChange={(isBookmarked) => handleBookmarkChange(article.id, isBookmarked)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No articles found in {selectedCategory} category</p>
        </div>
      )}

      {/* Paywall for free users */}
      {requiresAuth && !isSignedIn && (
        <div className="py-12 text-center border-t border-border mt-8">
          <div className="max-w-md mx-auto">
            <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Unlock More News</h3>
            <p className="text-muted-foreground mb-6">
              You've viewed 10 free articles. Sign in to continue reading unlimited news.
            </p>
            <Button asChild className="w-full">
              <a href="/sign-in">Sign In to Continue</a>
            </Button>
          </div>
        </div>
      )}

      {/* Infinite scroll trigger */}
      <div ref={observerTarget} className="py-8 text-center">
        {isLoadingMore && (
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        )}
        {!hasMore && articles.length > 0 && !requiresAuth && (
          <p className="text-muted-foreground">🎉 You've reached the end of the news universe! </p>
        )}
      </div>
    </div>
  )
}
