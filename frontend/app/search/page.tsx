'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { X, Clock, Lock, ArrowLeft, Sparkles, Hash } from 'lucide-react'
import Link from 'next/link'
import { NewsCard } from '@/components/NewsCard'
import { Article, searchArticles } from '@/lib/api'

const HISTORY_KEY = 'search_history'
const MAX_HISTORY = 10

function getHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  } catch {
    return []
  }
}

function saveToHistory(query: string) {
  const history = getHistory().filter(q => q !== query)
  history.unshift(query)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)))
}

function removeFromHistory(query: string) {
  const history = getHistory().filter(q => q !== query)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

export default function SearchPage() {
  const { isSignedIn, isLoaded } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const query = searchParams.get('q') || ''

  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState(query)
  const [history, setHistory] = useState<string[]>([])
  const [searchMode, setSearchMode] = useState<'keyword' | 'semantic'>('keyword')

  useEffect(() => {
    setHistory(getHistory())
  }, [])

  const runSearch = async (q: string) => {
    if (!q.trim()) {
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
      const result = await searchArticles(q, 20, 0, searchMode)
      setArticles(result.articles)
      if (result.count === 0) {
        setError(`No articles found for "${q}"`)
      } else {
        saveToHistory(q)
        setHistory(getHistory())
      }
    } catch (err: any) {
      setError(err.message || 'Failed to search articles')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    runSearch(searchQuery)
  }

  const handleHistoryClick = (q: string) => {
    setSearchQuery(q)
    runSearch(q)
  }

  const handleRemoveHistory = (q: string, e: React.MouseEvent) => {
    e.stopPropagation()
    removeFromHistory(q)
    setHistory(getHistory())
  }

  useEffect(() => {
    if (query) {
      setSearchQuery(query)
      runSearch(query)
    } else {
      setLoading(true)
      const load = async () => {
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
      load()
    }
  }, [])

  if (isLoaded && !isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-sm">
          <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Sign in to Search</h2>
          <p className="text-muted-foreground mb-6 text-sm">
            Search is a premium feature. Sign in to search articles by title or hashtags.
          </p>
          <Link
            href="/sign-in"
            className="inline-block px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Back button + Search Bar */}
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={() => router.push('/')}
            className="flex items-center justify-center w-9 h-9 shrink-0 border border-input rounded-lg hover:bg-muted transition-colors"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <form onSubmit={handleSearch} className="flex gap-2 flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search articles by title or hashtags..."
              className="flex-1 px-4 py-2 border border-input rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary dark:bg-slate-900 dark:border-slate-700 dark:text-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); runSearch('') }}
                className="px-3 py-2 border border-input rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Search
            </button>
          </form>
        </div>

        {/* Search mode toggle */}
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSearchMode('keyword')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-colors ${
              searchMode === 'keyword'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-input text-muted-foreground hover:bg-muted'
            }`}
          >
            <Hash className="w-3 h-3" />
            Keyword
          </button>
          <button
            type="button"
            onClick={() => setSearchMode('semantic')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-colors ${
              searchMode === 'semantic'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-input text-muted-foreground hover:bg-muted'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            Semantic AI
          </button>
          {searchMode === 'semantic' && (
            <span className="text-xs text-muted-foreground">Search by meaning, not just words</span>
          )}
        </div>

        {/* Search History Chips */}
        {history.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2 items-center">
            <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            {history.map(q => (
              <button
                key={q}
                onClick={() => handleHistoryClick(q)}
                className="flex items-center gap-1 px-3 py-1 text-xs rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                {q}
                <X
                  className="w-3 h-3 ml-0.5 hover:text-foreground"
                  onClick={(e) => handleRemoveHistory(q, e)}
                />
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        {loading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
            {searchQuery
              ? searchMode === 'semantic' ? 'Searching by meaning...' : 'Searching...'
              : 'Loading articles...'}
          </p>
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
              {searchQuery
                ? `Found ${articles.length} article${articles.length !== 1 ? 's' : ''} for "${searchQuery}"`
                : `Showing ${articles.length} articles`}
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

        {!searchQuery && !loading && articles.length === 0 && !error && (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No articles available</p>
            <button
              onClick={() => router.push('/')}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-input rounded-lg hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to News Feed
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
