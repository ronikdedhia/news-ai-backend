'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { useApiClient } from '@/lib/useApiClient'
import { fetchArticles, fetchPersonalizedArticles, Article, syncUser, searchArticles, dismissArticle } from '@/lib/api'
import { saveArticlesOffline, getOfflineArticles } from '@/lib/offlineStorage'
import { useOffline } from '@/lib/useOffline'
import { NewsCard } from './NewsCard'
import { CategoryFilter } from './CategoryFilter'
import { WeeklyWrapButton } from './WeeklyWrap'
import { CatchUpBrief } from './CatchUpBrief'
import { DailyBriefing } from './DailyBriefing'
import { TrendingHashtags } from './TrendingHashtags'
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp'
import { AlertCircle, Lock, WifiOff, Sparkles, RefreshCw, Tag, Clock, ThumbsUp, Keyboard } from 'lucide-react'
import { Button } from './ui/button'

export function NewsFeed() {
  const { isSignedIn } = useAuth()
  const { user: clerkUser } = useUser()
  useApiClient()
  const isOnline = useOffline()
  
  const [articles, setArticles] = useState<(Article & { isBookmarked?: boolean })[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [tier, setTier] = useState<'free' | 'premium'>('free')
  const [requiresAuth, setRequiresAuth] = useState(false)
  const [isOfflineMode, setIsOfflineMode] = useState(false)
  const [feedMode, setFeedMode] = useState<'latest' | 'foryou'>('latest')
  const [personalizedArticles, setPersonalizedArticles] = useState<(Article & { isBookmarked?: boolean })[]>([])
  const [personalizedLoading, setPersonalizedLoading] = useState(false)
  const [personalizedError, setPersonalizedError] = useState<string | null>(null)

  // source filter
  const [selectedSource, setSelectedSource] = useState<string | null>(null)

  // read/unread tracking
  const [readArticleIds, setReadArticleIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem('db_read_articles')
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch { return new Set() }
  })

  const handleDismiss = useCallback((id: string) => {
    setArticles(prev => prev.filter(a => a.id !== id))
    setPersonalizedArticles(prev => prev.filter(a => a.id !== id))
    dismissArticle(id).catch(() => {})
  }, [])

  const markAsRead = useCallback((id: string) => {
    setReadArticleIds(prev => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      try { localStorage.setItem('db_read_articles', JSON.stringify([...next])) } catch {}
      return next
    })
  }, [])

  // sentiment filter
  const [hiddenSentiments, setHiddenSentiments] = useState<Set<string>>(new Set())

  // keyboard shortcuts state
  const [focusedIdx, _setFocusedIdx]    = useState(-1)
  const focusedIdxRef                    = useRef(-1)
  const [pendingAction, setPendingAction] = useState<{ action: 'bookmark' | 'upvote' | 'downvote' | 'open'; seq: number } | null>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)

  // trending hashtags
  const [trendingTag, setTrendingTag]   = useState<string | null>(null)
  const [hashtagArticles, setHashtagArticles] = useState<Article[]>([])
  const [hashtagLoading, setHashtagLoading]   = useState(false)

  const cardRefs    = useRef<(HTMLDivElement | null)[]>([])
  const searchRef   = useRef<HTMLInputElement>(null)
  const observerTarget = useRef<HTMLDivElement>(null)
  const hasInitialized = useRef(false)

  const setFocusedIdx = (n: number) => { focusedIdxRef.current = n; _setFocusedIdx(n) }
  const displayedLen  = useRef(0) // updated each render

  const FREE_TIER_LIMIT = 10
  const LIMIT = isSignedIn ? 20 : 10

  const loadNews = useCallback(async (newOffset: number = 0) => {
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
        try {
          await saveArticlesOffline(data.articles)
        } catch (err) {
          console.error('[NewsFeed] Error saving offline:', err)
        }
        setIsOfflineMode(false)
        
        const shouldHaveMore = data.count === LIMIT;
        setOffset(newOffset + LIMIT)
        setHasMore(shouldHaveMore)
      } else {
        const newArticles = [...articles, ...data.articles]
        setArticles(newArticles)
        
        try {
          await saveArticlesOffline(newArticles)
        } catch (err) {
          console.error('[NewsFeed] Error saving offline:', err)
        }
        
        const shouldHaveMore = data.count === LIMIT;
        setOffset(newOffset + LIMIT)
        setHasMore(shouldHaveMore)
      }
    } catch (err: any) {
      console.error('[NewsFeed] Network error:', err)
      
      if (err.response?.status === 401) {
        setError('Your session has expired. Please sign in again.')
        setRequiresAuth(true)
        setHasMore(false)
        return
      }
      
      if (!isOnline) {
        try {
          const offlineArticles = await getOfflineArticles()
          if (offlineArticles.length > 0) {
            setArticles(offlineArticles)
            setIsOfflineMode(true)
            setError(null)
            setHasMore(false)
            setLoading(false)
            setIsLoadingMore(false)
            return
          }
        } catch (cacheErr) {
          console.error('[NewsFeed] Error loading offline articles:', cacheErr)
        }
      }
      
      setError(err instanceof Error ? err.message : 'Failed to load news')
      setHasMore(false)
    } finally {
      setLoading(false)
      setIsLoadingMore(false)
    }
  }, [articles, LIMIT, isOnline])

  const loadPersonalized = async () => {
    setPersonalizedLoading(true)
    setPersonalizedError(null)
    try {
      const data = await fetchPersonalizedArticles()
      setPersonalizedArticles(data.articles)
      if (data.count === 0) setPersonalizedError('No personalised articles yet — upvote some articles or set category preferences to train your feed.')
    } catch (err: any) {
      setPersonalizedError('Failed to load personalised feed.')
    } finally {
      setPersonalizedLoading(false)
    }
  }

  const handleFeedModeChange = (mode: 'latest' | 'foryou') => {
    setFeedMode(mode)
    setSelectedCategory(null)
    setSelectedSource(null)
    if (mode === 'foryou' && personalizedArticles.length === 0) {
      loadPersonalized()
    }
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return

      const len = displayedLen.current
      switch (e.key) {
        case 'j': {
          e.preventDefault()
          const next = focusedIdxRef.current < 0 ? 0 : Math.min(len - 1, focusedIdxRef.current + 1)
          setFocusedIdx(next)
          requestAnimationFrame(() => cardRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
          break
        }
        case 'k': {
          e.preventDefault()
          const prev = Math.max(0, focusedIdxRef.current <= 0 ? 0 : focusedIdxRef.current - 1)
          setFocusedIdx(prev)
          requestAnimationFrame(() => cardRefs.current[prev]?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
          break
        }
        case 'b':
          if (focusedIdxRef.current >= 0)
            setPendingAction(p => ({ action: 'bookmark', seq: (p?.seq ?? 0) + 1 }))
          break
        case 'u':
          if (focusedIdxRef.current >= 0)
            setPendingAction(p => ({ action: 'upvote', seq: (p?.seq ?? 0) + 1 }))
          break
        case 'd':
          if (focusedIdxRef.current >= 0)
            setPendingAction(p => ({ action: 'downvote', seq: (p?.seq ?? 0) + 1 }))
          break
        case 'o':
        case 'Enter':
          if (focusedIdxRef.current >= 0)
            setPendingAction(p => ({ action: 'open', seq: (p?.seq ?? 0) + 1 }))
          break
        case '/':
          e.preventDefault()
          searchRef.current?.focus()
          break
        case '?':
        case ' ':
          e.preventDefault()
          setShowShortcuts(v => !v)
          break
        case 'Escape':
          setShowShortcuts(false)
          setFocusedIdx(-1)
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, []) // intentionally empty — uses refs for all mutable state

  // ── Click outside any card to deselect ───────────────────────────────────
  useEffect(() => {
    if (focusedIdx < 0) return
    const handler = (e: MouseEvent) => {
      const inside = cardRefs.current.some(ref => ref?.contains(e.target as Node))
      if (!inside) setFocusedIdx(-1)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [focusedIdx])

  // ── Trending hashtag search ───────────────────────────────────────────────
  const handleTrendingSelect = async (tag: string) => {
    if (trendingTag === tag) {
      setTrendingTag(null)
      setHashtagArticles([])
      return
    }
    setTrendingTag(tag)
    setHashtagLoading(true)
    try {
      const res = await searchArticles(tag.replace(/^#/, ''), 20, 0)
      setHashtagArticles(res.articles)
    } catch { setHashtagArticles([]) }
    finally { setHashtagLoading(false) }
  }

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

  // Load offline articles on mount if offline
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true
      
      // If offline, try to load cached articles first
      if (!isOnline) {
        getOfflineArticles().then((offlineArticles) => {
          if (offlineArticles.length > 0) {
            setArticles(offlineArticles)
            setIsOfflineMode(true)
            setLoading(false)
            setHasMore(false)
            return
          }
          // If no cached articles, try to load from network
          loadNews(0)
        })
      } else {
        // Online, load from network
        loadNews(0)
      }
    }
  }, [isOnline, loadNews])

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

  const handleBookmarkChange = (articleId: string, isBookmarked: boolean) => {
    setArticles(prev => prev.map(article => 
      article.id === articleId ? { ...article, isBookmarked } : article
    ))
  }

  // Derive available sources sorted by article count
  const availableSources = (() => {
    const counts: Record<string, number> = {}
    for (const a of articles) {
      try {
        const d = new URL(a.url).hostname.replace(/^www\./, '')
        if (d) counts[d] = (counts[d] || 0) + 1
      } catch {}
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([d]) => d)
  })()

  // Filter articles by selected category
  const categoryFiltered = selectedCategory
    ? selectedCategory === 'others'
      ? articles.filter(article => !article.category || article.category.trim() === '')
      : articles.filter(article => article.category?.toLowerCase() === selectedCategory.toLowerCase())
    : articles

  // Apply source filter
  const filteredArticles = selectedSource
    ? categoryFiltered.filter(a => {
        try { return new URL(a.url).hostname.replace(/^www\./, '') === selectedSource }
        catch { return false }
      })
    : categoryFiltered

  // Apply sentiment filter on top of category + source filter
  const sentimentFiltered = hiddenSentiments.size > 0
    ? filteredArticles.filter(a => !a.sentiment || !hiddenSentiments.has(a.sentiment))
    : filteredArticles

  // Active display list (for keyboard index)
  const displayedArticles: Article[] =
    trendingTag ? hashtagArticles
    : feedMode === 'foryou' ? personalizedArticles
    : sentimentFiltered
  displayedLen.current = displayedArticles.length

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
    setSelectedSource(null)
    setError(null)
    setTrendingTag(null)
    setHashtagArticles([])
  }

  // Helper: render a single card with keyboard + ref wiring
  const renderCard = (article: Article & { isBookmarked?: boolean }, idx: number, onBMChange: (v: boolean) => void, showRank = false) => (
    <div
      key={article.id}
      ref={el => { cardRefs.current[idx] = el as HTMLDivElement | null }}
      onClick={() => setFocusedIdx(focusedIdx === idx ? -1 : idx)}
      className={`flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-4 duration-300 rounded-3xl cursor-pointer outline-none transition-all ${
        focusedIdx === idx
          ? 'ring-4 ring-indigo-500 ring-offset-2 shadow-2xl shadow-indigo-500/30'
          : 'ring-0'
      }`}
    >
      <NewsCard
        article={article}
        isFocused={focusedIdx === idx}
        triggerAction={focusedIdx === idx ? pendingAction : null}
        onActionDone={() => setPendingAction(null)}
        onBookmarkChange={onBMChange}
        isRead={readArticleIds.has(article.id)}
        onRead={() => markAsRead(article.id)}
        onDismiss={isSignedIn ? () => handleDismiss(article.id) : undefined}
      />
      {showRank && article._rankReason && (
        <div className="flex items-center gap-1.5 px-1 flex-wrap">
          {article._rankReason.categoryMatch && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium">
              <Tag className="w-2.5 h-2.5" /> Category match
            </span>
          )}
          {article._rankReason.hashtagMatches > 0 && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 font-medium">
              <ThumbsUp className="w-2.5 h-2.5" /> {article._rankReason.hashtagMatches} topic{article._rankReason.hashtagMatches > 1 ? 's' : ''} you upvoted
            </span>
          )}
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-muted-foreground font-medium">
            <Clock className="w-2.5 h-2.5" />
            {article._rankReason.hoursOld < 1 ? 'Just now' : `${article._rankReason.hoursOld}h ago`}
          </span>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Keyboard shortcuts modal */}
      {showShortcuts && <KeyboardShortcutsHelp onClose={() => setShowShortcuts(false)} />}

      <div className="space-y-6">
        {/* Offline Indicator */}
        {!isOnline && (
          <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <div>
              <p className="font-semibold text-yellow-900 dark:text-yellow-100">You&apos;re offline</p>
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                {isOfflineMode ? 'Showing cached articles' : 'Connect to internet to load new articles'}
              </p>
            </div>
          </div>
        )}

        {/* Header + Feed Mode Toggle + Shortcuts hint */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-3xl font-black tracking-tight bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 dark:from-indigo-400 dark:via-violet-400 dark:to-purple-400 bg-clip-text text-transparent">
              Today&rsquo;s Bytes
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {tier === 'premium' ? 'Unlimited access · AI-curated for you' : 'Free tier · 10 articles'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isSignedIn && (
              <div className="flex rounded-2xl p-1 gap-1 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-white/40 dark:border-white/10">
                <button
                  onClick={() => handleFeedModeChange('latest')}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-xl transition-all ${
                    feedMode === 'latest'
                      ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Latest
                </button>
                <button
                  onClick={() => handleFeedModeChange('foryou')}
                  className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-xl transition-all ${
                    feedMode === 'foryou'
                      ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  For You
                </button>
              </div>
            )}
            {isSignedIn && (
              <WeeklyWrapButton className="p-2 rounded-xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-white/40 dark:border-white/10 text-muted-foreground hover:text-foreground transition-colors" />
            )}
            <button
              onClick={() => setShowShortcuts(true)}
              title="Keyboard shortcuts (?)"
              className="p-2 rounded-xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-white/40 dark:border-white/10 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Keyboard className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Daily Briefing */}
        {isSignedIn && feedMode === 'latest' && articles.length > 0 && (
          <DailyBriefing articles={articles} />
        )}

        {/* Catch-up brief — only on latest tab, signed-in users */}
        {isSignedIn && feedMode === 'latest' && <CatchUpBrief />}

        {/* Latest tab: Category filter + Trending + Search */}
        {feedMode === 'latest' && (
          <>
            <CategoryFilter selectedCategory={selectedCategory} onCategoryChange={handleCategoryChange} />

            {/* Sentiment filter pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50 shrink-0">Mood</span>
              {([
                { key: 'positive', label: 'Positive', on: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/40', off: 'bg-black/[0.04] dark:bg-white/[0.05] text-muted-foreground/40 border-black/[0.06] dark:border-white/[0.06] line-through' },
                { key: 'neutral',  label: 'Neutral',  on: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-300/50 dark:border-slate-600/40', off: 'bg-black/[0.04] dark:bg-white/[0.05] text-muted-foreground/40 border-black/[0.06] dark:border-white/[0.06] line-through' },
                { key: 'negative', label: 'Negative', on: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-400/40', off: 'bg-black/[0.04] dark:bg-white/[0.05] text-muted-foreground/40 border-black/[0.06] dark:border-white/[0.06] line-through' },
              ] as const).map(({ key, label, on, off }) => {
                const hidden = hiddenSentiments.has(key)
                return (
                  <button
                    key={key}
                    onClick={() => setHiddenSentiments(prev => {
                      const next = new Set(prev)
                      if (next.has(key)) next.delete(key); else next.add(key)
                      return next
                    })}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-all duration-150 ${hidden ? off : on}`}
                    title={hidden ? `Show ${label.toLowerCase()} news` : `Hide ${label.toLowerCase()} news`}
                  >
                    {label}
                  </button>
                )
              })}
              {hiddenSentiments.size > 0 && (
                <button
                  onClick={() => setHiddenSentiments(new Set())}
                  className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Source filter */}
            {availableSources.length > 1 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50 shrink-0">Source</span>
                <button
                  onClick={() => setSelectedSource(null)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-all duration-150 ${
                    selectedSource === null
                      ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-400/40'
                      : 'bg-black/[0.04] dark:bg-white/[0.05] text-muted-foreground/60 border-black/[0.06] dark:border-white/[0.06] hover:text-foreground'
                  }`}
                >
                  All
                </button>
                {availableSources.map(src => (
                  <button
                    key={src}
                    onClick={() => setSelectedSource(selectedSource === src ? null : src)}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-all duration-150 ${
                      selectedSource === src
                        ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-400/40'
                        : 'bg-black/[0.04] dark:bg-white/[0.05] text-muted-foreground/60 border-black/[0.06] dark:border-white/[0.06] hover:text-foreground'
                    }`}
                  >
                    {src}
                  </button>
                ))}
                {selectedSource && (
                  <button
                    onClick={() => setSelectedSource(null)}
                    className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
            )}

            {/* Trending Hashtags strip */}
            <TrendingHashtags onSelect={handleTrendingSelect} selectedTag={trendingTag} />

            {/* Search Bar */}
            <div className="flex gap-2">
              <input
                ref={searchRef}
                type="text"
                placeholder={isSignedIn ? 'Search articles by title or hashtags... (press / )' : 'Sign in to search articles...'}
                readOnly={!isSignedIn}
                onClick={() => { if (!isSignedIn) window.location.href = '/sign-in' }}
                onKeyDown={(e) => {
                  if (!isSignedIn) return
                  if (e.key === 'Enter') {
                    const query = (e.target as HTMLInputElement).value
                    if (query.trim()) window.location.href = `/search?q=${encodeURIComponent(query)}`
                  }
                }}
                className={`flex-1 px-4 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-white/40 dark:border-white/10 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all ${!isSignedIn ? 'cursor-pointer opacity-60' : ''}`}
              />
            </div>
          </>
        )}

        {/* Trending tag active banner */}
        {trendingTag && (
          <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-400/20">
            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
              Showing results for <span className="font-black">{trendingTag}</span>
            </p>
            <button
              onClick={() => { setTrendingTag(null); setHashtagArticles([]) }}
              className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
            >
              ✕ Clear
            </button>
          </div>
        )}

        {/* For You feed */}
        {!trendingTag && feedMode === 'foryou' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-muted-foreground">
                Ranked by category preferences · upvote history · recency
              </p>
              <button
                onClick={loadPersonalized}
                disabled={personalizedLoading}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                <RefreshCw className={`w-3 h-3 ${personalizedLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            {personalizedLoading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
              </div>
            ) : personalizedError ? (
              <div className="text-center py-12">
                <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">{personalizedError}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
                {personalizedArticles.map((article, idx) =>
                  renderCard(article, idx, (bm) => setPersonalizedArticles(prev => prev.map(a => a.id === article.id ? { ...a, isBookmarked: bm } : a)), true)
                )}
              </div>
            )}
          </div>
        )}

        {/* Trending hashtag results */}
        {trendingTag && (
          hashtagLoading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
            </div>
          ) : hashtagArticles.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No articles found for {trendingTag}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
              {hashtagArticles.map((article, idx) =>
                renderCard(article, idx, (bm) => setHashtagArticles(prev => prev.map(a => a.id === article.id ? { ...a, isBookmarked: bm } : a)))
              )}
            </div>
          )
        )}

        {/* Latest Articles Grid */}
        {!trendingTag && feedMode === 'latest' && (sentimentFiltered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
            {sentimentFiltered.map((article, idx) =>
              renderCard(article, idx, (bm) => handleBookmarkChange(article.id, bm))
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {hiddenSentiments.size > 0 ? 'All articles filtered out — try adjusting your mood filter' : `No articles found in ${selectedCategory} category`}
            </p>
          </div>
        ))}

        {/* Paywall for free users */}
        {requiresAuth && !isSignedIn && (
          <div className="py-12 text-center border-t border-border mt-8">
            <div className="max-w-md mx-auto">
              <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Unlock More News</h3>
              <p className="text-muted-foreground mb-6">
                You&apos;ve viewed 10 free articles. Sign in to continue reading unlimited news.
              </p>
              <Link href="/sign-in" className="inline-block w-full">
                <Button className="w-full">Sign In to Continue</Button>
              </Link>
            </div>
          </div>
        )}

        {/* Keyboard shortcut hint */}
        {focusedIdx >= 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 dark:bg-slate-100/90 text-white dark:text-slate-900 text-[11px] font-medium shadow-xl backdrop-blur-sm">
              <kbd className="font-mono">j/k</kbd><span>navigate</span>
              <span className="opacity-30">·</span>
              <kbd className="font-mono">b</kbd><span>bookmark</span>
              <span className="opacity-30">·</span>
              <kbd className="font-mono">u/d</kbd><span>vote</span>
              <span className="opacity-30">·</span>
              <kbd className="font-mono">o</kbd><span>open</span>
              <span className="opacity-30">·</span>
              <kbd className="font-mono">Esc</kbd><span>deselect</span>
            </div>
          </div>
        )}

        {/* Infinite scroll trigger */}
        {!trendingTag && feedMode === 'latest' && (
          <div ref={observerTarget} className="py-8 text-center">
            {isLoadingMore && (
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            )}
            {!hasMore && articles.length > 0 && !requiresAuth && (
              <p className="text-muted-foreground">🎉 You&apos;ve reached the end of the news universe!</p>
            )}
          </div>
        )}
      </div>
    </>
  )
}
