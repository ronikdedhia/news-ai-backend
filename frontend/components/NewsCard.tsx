'use client'

import { useState, useEffect, useRef, useCallback, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { useAuth } from '@clerk/nextjs'
import {
  ExternalLink, Volume2, Square, Bookmark, ThumbsUp, ThumbsDown,
  ChevronDown, ChevronUp, User, Building2, MapPin,
  TrendingUp, TrendingDown, Minus, MessageSquare, Lightbulb, Highlighter, Trash2, FolderOpen, Check, HelpCircle,
} from 'lucide-react'
import { Article, Entity, SimilarArticle, Highlight, BookmarkFolder, addBookmark, removeBookmark, reactToArticle, getSimilarArticles, getHighlights, addHighlight, deleteHighlight, fetchWhyItMatters, fetchQuestions, getFolders, assignToFolder } from '@/lib/api'
import { ShareableImage } from '@/components/ShareableImage'
import { CommentSection } from '@/components/CommentSection'
import { CATEGORY_COLORS } from '@/lib/categories'

const SENTIMENT_CONFIG = {
  positive: { label: 'Bullish',   Icon: TrendingUp,   cls: 'bg-emerald-400/20 text-emerald-300 border-emerald-400/30' },
  neutral:  { label: 'Neutral',   Icon: Minus,        cls: 'bg-white/10 text-white/80 border-white/30'               },
  negative: { label: 'Bearish',   Icon: TrendingDown, cls: 'bg-rose-400/20 text-rose-300 border-rose-400/30'         },
} as const

const ENTITY_ICON = { person: User, company: Building2, place: MapPin } as const

const ENTITY_CHIP: Record<string, string> = {
  person:  'bg-amber-100 dark:bg-amber-400/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-400/40',
  company: 'bg-sky-100 dark:bg-sky-400/20 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-400/40',
  place:   'bg-emerald-100 dark:bg-emerald-400/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-400/40',
}

const BIAS_CONFIG = {
  left:   { label: 'Left-lean',  cls: 'bg-blue-400/20 text-blue-300 border-blue-400/30' },
  center: { label: 'Balanced',   cls: 'bg-slate-400/20 text-slate-300 border-slate-400/30' },
  right:  { label: 'Right-lean', cls: 'bg-rose-400/20 text-rose-300 border-rose-400/30' },
} as const

const HL_COLORS: Record<string, { dot: string; bg: string }> = {
  yellow: { dot: 'bg-yellow-400',  bg: 'bg-yellow-200/80 dark:bg-yellow-400/30' },
  green:  { dot: 'bg-emerald-400', bg: 'bg-emerald-200/80 dark:bg-emerald-400/30' },
  blue:   { dot: 'bg-sky-400',     bg: 'bg-sky-200/80 dark:bg-sky-400/30' },
  pink:   { dot: 'bg-pink-400',    bg: 'bg-pink-200/80 dark:bg-pink-400/30' },
}

const CAT_GRADIENT: Record<string, string> = {
  technology:    'from-blue-500 to-cyan-500',
  business:      'from-emerald-500 to-teal-500',
  sports:        'from-orange-500 to-amber-500',
  entertainment: 'from-pink-500 to-rose-500',
  health:        'from-green-500 to-emerald-600',
  science:       'from-purple-500 to-violet-600',
  education:     'from-indigo-500 to-blue-600',
  politics:      'from-red-500 to-rose-600',
  world:         'from-sky-500 to-blue-500',
  nation:        'from-yellow-500 to-orange-500',
}

const CAT_CHIP: Record<string, string> = {
  technology: 'bg-blue-500', business: 'bg-emerald-500', sports: 'bg-orange-500',
  entertainment: 'bg-pink-500', health: 'bg-green-600', science: 'bg-purple-500',
  education: 'bg-indigo-500', politics: 'bg-red-500', world: 'bg-sky-500', nation: 'bg-yellow-500',
}

const timeAgo = (ts: string | Date): string => {
  try {
    const diff = Date.now() - new Date(ts).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  } catch { return '' }
}

const sourceDomain = (url: string): string => {
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch { return '' }
}

const truncate = (text: string, max = 400) =>
  text.length > max ? text.slice(0, 397) + '…' : text

function renderHighlightedContent(text: string, highlights: Highlight[]): ReactNode {
  if (!highlights.length) return text
  const ranges: Array<{ start: number; end: number; color: string; id: string }> = []
  for (const h of highlights) {
    const idx = text.indexOf(h.text)
    if (idx === -1) continue
    ranges.push({ start: idx, end: idx + h.text.length, color: h.color, id: h.id })
  }
  if (!ranges.length) return text
  ranges.sort((a, b) => a.start - b.start)
  const nodes: React.ReactNode[] = []
  let cursor = 0
  for (const r of ranges) {
    if (r.start < cursor) continue
    if (r.start > cursor) nodes.push(text.slice(cursor, r.start))
    nodes.push(
      <mark key={r.id} className={`${HL_COLORS[r.color]?.bg ?? HL_COLORS.yellow.bg} rounded-sm not-italic`}>
        {text.slice(r.start, r.end)}
      </mark>
    )
    cursor = r.end
  }
  if (cursor < text.length) nodes.push(text.slice(cursor))
  return <>{nodes}</>
}

interface NewsCardProps {
  article: Article & { isBookmarked?: boolean }
  onBookmarkChange?: (isBookmarked: boolean) => void
  isFocused?: boolean
  triggerAction?: { action: 'bookmark' | 'upvote' | 'downvote' | 'open'; seq: number } | null
  onActionDone?: () => void
}

export function NewsCard({ article, onBookmarkChange, isFocused, triggerAction, onActionDone }: NewsCardProps) {
  const { isSignedIn } = useAuth()
  const [isSpeaking, setIsSpeaking]     = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(article.isBookmarked || false)
  const [loadingBM, setLoadingBM]       = useState(false)
  const [userReaction, setUserReaction] = useState<'upvote' | 'downvote' | null>(article.userReaction ?? null)
  const [upvotes, setUpvotes]           = useState(article.upvoteCount ?? 0)
  const [downvotes, setDownvotes]       = useState(article.downvoteCount ?? 0)
  const [loadingRx, setLoadingRx]       = useState(false)
  const [showSimilar, setShowSimilar]   = useState(false)
  const [similar, setSimilar]           = useState<SimilarArticle[]>([])
  const [loadingSim, setLoadingSim]     = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [imgSrc, setImgSrc]             = useState(article.imageUrl || '/news-placeholder.png')
  const hasImage = !!article.imageUrl?.trim()

  // Why it matters
  const [whyItMatters, setWhyItMatters] = useState<string | null>(article.whyItMatters ?? null)
  const [loadingWhy, setLoadingWhy]     = useState(false)

  // Highlights
  const [highlights, setHighlights]             = useState<Highlight[]>([])
  const [showHighlights, setShowHighlights]     = useState(false)
  const [highlightsLoaded, setHighlightsLoaded] = useState(false)
  const [selectionPopover, setSelectionPopover] = useState<{ text: string; x: number; y: number } | null>(null)
  const contentRef = useRef<HTMLParagraphElement>(null)

  // Q&A
  const [questions, setQuestions]         = useState<Array<{ q: string; a: string }> | null>(
    article.questions ? (() => { try { return JSON.parse(article.questions!) } catch { return null } })() : null
  )
  const [showQuestions, setShowQuestions] = useState(false)
  const [loadingQA, setLoadingQA]         = useState(false)

  // Bookmark folder picker
  const [showFolderPicker, setShowFolderPicker]   = useState(false)
  const [folders, setFolders]                     = useState<BookmarkFolder[]>([])
  const [loadingFolders, setLoadingFolders]       = useState(false)
  const [activeFolderId, setActiveFolderId]       = useState<string | null>(article.bookmarkFolderId ?? null)

  useEffect(() => {
    setIsBookmarked(article.isBookmarked || false)
    setUserReaction(article.userReaction ?? null)
    setUpvotes(article.upvoteCount ?? 0)
    setDownvotes(article.downvoteCount ?? 0)
  }, [article.isBookmarked, article.userReaction, article.upvoteCount, article.downvoteCount])

  const requireAuth = () => { window.location.href = '/sign-in' }

  const handleSpeak = () => {
    if (!isSignedIn) { requireAuth(); return }
    if (isSpeaking) { window.speechSynthesis.cancel(); setIsSpeaking(false); return }
    window.speechSynthesis.cancel()
    setIsSpeaking(true)

    const doSpeak = () => {
      const u = new SpeechSynthesisUtterance(`${article.title}. ${article.content || ''}`)
      u.rate = 1
      const voices = window.speechSynthesis.getVoices()
      const voice = voices.find(v => v.lang.startsWith('en-') && !v.localService)
        ?? voices.find(v => v.lang.startsWith('en'))
        ?? voices[0]
      if (voice) u.voice = voice
      u.onend = () => setIsSpeaking(false)
      u.onerror = (e) => { if (e.error !== 'interrupted' && e.error !== 'canceled') setIsSpeaking(false) }
      window.speechSynthesis.resume()
      window.speechSynthesis.speak(u)
    }

    setTimeout(() => {
      const voices = window.speechSynthesis.getVoices()
      if (voices.length > 0) {
        doSpeak()
      } else {
        window.speechSynthesis.addEventListener('voiceschanged', doSpeak, { once: true })
      }
    }, 120)
  }

  const handleBookmark = async () => {
    if (!isSignedIn) { requireAuth(); return }
    setLoadingBM(true)
    try {
      isBookmarked ? await removeBookmark(article.id) : await addBookmark(article.id)
      setIsBookmarked(v => !v); onBookmarkChange?.(!isBookmarked)
    } catch (e) { console.error(e) } finally { setLoadingBM(false) }
  }

  const handleReaction = async (type: 'upvote' | 'downvote') => {
    if (!isSignedIn) { requireAuth(); return }
    setLoadingRx(true)
    try {
      const prev = userReaction
      const res  = await reactToArticle(article.id, type)
      if (prev === type) {
        type === 'upvote' ? setUpvotes(c => Math.max(0,c-1)) : setDownvotes(c => Math.max(0,c-1))
      } else {
        if (prev) { prev === 'upvote' ? setUpvotes(c=>Math.max(0,c-1)) : setDownvotes(c=>Math.max(0,c-1)) }
        type === 'upvote' ? setUpvotes(c=>c+1) : setDownvotes(c=>c+1)
      }
      setUserReaction(res.reaction)
    } catch (e) { console.error(e) } finally { setLoadingRx(false) }
  }

  const handleSimilar = async () => {
    if (!isSignedIn) { requireAuth(); return }
    if (!showSimilar && similar.length === 0) {
      setLoadingSim(true); setSimilar(await getSimilarArticles(article.id)); setLoadingSim(false)
    }
    setShowSimilar(v => !v)
  }

  const handleFetchWhy = async () => {
    if (!isSignedIn) { requireAuth(); return }
    setLoadingWhy(true)
    const why = await fetchWhyItMatters(article.id)
    setWhyItMatters(why)
    setLoadingWhy(false)
  }

  const handleToggleQuestions = async () => {
    if (!isSignedIn) { requireAuth(); return }
    if (!showQuestions && questions === null) {
      setShowQuestions(true)
      setLoadingQA(true)
      const qs = await fetchQuestions(article.id)
      setQuestions(qs.length ? qs : [])
      setLoadingQA(false)
      return
    }
    setShowQuestions(v => !v)
  }

  const handleShowHighlights = async () => {
    if (!isSignedIn) { requireAuth(); return }
    if (!highlightsLoaded) {
      const data = await getHighlights(article.id)
      setHighlights(data)
      setHighlightsLoaded(true)
    }
    setShowHighlights(v => !v)
  }

  const handleDeleteHighlight = async (id: string) => {
    await deleteHighlight(article.id, id)
    setHighlights(prev => prev.filter(h => h.id !== id))
  }

  const handleTextMouseUp = useCallback(() => {
    if (!isSignedIn) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.toString().trim() || sel.toString().trim().length < 3) {
      setSelectionPopover(null)
      return
    }
    if (!contentRef.current?.contains(sel.anchorNode)) { setSelectionPopover(null); return }
    const range = sel.getRangeAt(0)
    const rect  = range.getBoundingClientRect()
    setSelectionPopover({ text: sel.toString().trim(), x: rect.left + rect.width / 2, y: rect.top })
  }, [isSignedIn])

  const handleHighlightSave = async (color: string) => {
    if (!selectionPopover) return
    try {
      const h = await addHighlight(article.id, selectionPopover.text, color)
      setHighlights(prev => [...prev, h])
      setHighlightsLoaded(true)
    } catch {}
    setSelectionPopover(null)
    window.getSelection()?.removeAllRanges()
  }

  const handleOpenFolderPicker = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isSignedIn) { requireAuth(); return }
    if (!showFolderPicker && folders.length === 0) {
      setLoadingFolders(true)
      const data = await getFolders()
      setFolders(data)
      setLoadingFolders(false)
    }
    setShowFolderPicker(v => !v)
  }

  const handleAssignFolder = async (folderId: string | null) => {
    try {
      await assignToFolder(article.id, folderId)
      setActiveFolderId(folderId)
    } catch (e) { console.error(e) }
    setShowFolderPicker(false)
  }

  // Dismiss folder picker on outside click
  useEffect(() => {
    if (!showFolderPicker) return
    const handler = () => setShowFolderPicker(false)
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showFolderPicker])

  // Dismiss highlight popover on click outside
  useEffect(() => {
    if (!selectionPopover) return
    const handler = (e: MouseEvent) => {
      setSelectionPopover(null)
      window.getSelection()?.removeAllRanges()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [selectionPopover])

  // Keyboard shortcut action triggered by parent (NewsFeed)
  const prevSeqRef = useRef<number | null>(null)
  useEffect(() => {
    if (!triggerAction || triggerAction.seq === prevSeqRef.current) return
    prevSeqRef.current = triggerAction.seq
    onActionDone?.()
    if (triggerAction.action === 'bookmark') handleBookmark()
    else if (triggerAction.action === 'upvote') handleReaction('upvote')
    else if (triggerAction.action === 'downvote') handleReaction('downvote')
    else if (triggerAction.action === 'open') window.open(article.url, '_blank', 'noopener,noreferrer')
  }, [triggerAction?.seq])

  const sentiment = article.sentiment && SENTIMENT_CONFIG[article.sentiment as keyof typeof SENTIMENT_CONFIG]
    ? SENTIMENT_CONFIG[article.sentiment as keyof typeof SENTIMENT_CONFIG] : null
  const catKey  = article.category?.toLowerCase() ?? ''
  const catGrad = CAT_GRADIENT[catKey] ?? 'from-indigo-500 to-violet-600'
  const catChip = CAT_CHIP[catKey] ?? 'bg-indigo-500'

  return (
    <div className={`relative p-[1.5px] rounded-3xl bg-gradient-to-br ${catGrad} group h-full flex flex-col transition-all duration-150 ${isFocused ? 'scale-[1.01]' : ''}`}>
      {/* ambient glow behind card on hover */}
      <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${catGrad} opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500 -z-10`} />

      <article className="relative rounded-[calc(1.5rem-1.5px)] overflow-hidden flex flex-col h-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl">

        {/* ── image area ── */}
        <div className="relative h-48 flex-shrink-0 overflow-hidden">
          {hasImage ? (
            <Image
              src={imgSrc} alt={article.title} fill
              className="object-cover group-hover:scale-105 transition-transform duration-700"
              priority={false}
              onError={() => setImgSrc('/news-placeholder.png')}
            />
          ) : (
            <div className={`absolute inset-0 bg-gradient-to-br ${catGrad}`}>
              <div className="absolute inset-0 opacity-20"
                style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
            </div>
          )}
          {/* bottom scrim so chips are legible */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

          {/* chips pinned to bottom of image */}
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {article.category && (
                <span className={`${catChip} text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-lg`}>
                  {article.category}
                </span>
              )}
              {sentiment && (
                <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border backdrop-blur-sm ${sentiment.cls}`}>
                  <sentiment.Icon className="w-2.5 h-2.5" />{sentiment.label}
                </span>
              )}
              {article.biasLabel && BIAS_CONFIG[article.biasLabel as keyof typeof BIAS_CONFIG] && (
                <Tooltip label={`Framing bias · confidence ${article.biasScore ?? '?'}%`}>
                  <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border backdrop-blur-sm ${BIAS_CONFIG[article.biasLabel as keyof typeof BIAS_CONFIG].cls}`}>
                    {BIAS_CONFIG[article.biasLabel as keyof typeof BIAS_CONFIG].label}
                  </span>
                </Tooltip>
              )}
            </div>
            {article.publishedAt && (
              <span className="text-[10px] text-white/85 bg-black/45 backdrop-blur-sm px-2 py-0.5 rounded-full flex-shrink-0">
                {timeAgo(article.publishedAt)}
              </span>
            )}
          </div>
        </div>

        {/* ── readable content panel ── */}
        <div className="flex flex-col flex-1 p-4 space-y-2.5">

          {/* source row */}
          <div className="flex items-center gap-1.5">
            <div className={`w-4 h-4 rounded-full bg-gradient-to-br ${catGrad} flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <span className="text-white text-[7px] font-black uppercase">{sourceDomain(article.url).slice(0,1)}</span>
            </div>
            <span className="text-[11px] text-muted-foreground font-medium truncate">{sourceDomain(article.url)}</span>
            {article.content && (
              <>
                <span className="text-muted-foreground/40 text-[10px]">·</span>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                  {Math.max(1, Math.ceil(article.content.split(/\s+/).length / 200))} min read
                </span>
              </>
            )}
          </div>

          {/* title */}
          <h3 className="text-[14px] font-bold text-foreground leading-snug line-clamp-2 tracking-tight">
            {article.title}
          </h3>

          {/* Why it matters */}
          {whyItMatters ? (
            <div className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/25">
              <Lightbulb className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-snug font-medium">{whyItMatters}</p>
            </div>
          ) : (
            <button
              onClick={handleFetchWhy}
              disabled={loadingWhy}
              className="self-start flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors disabled:opacity-50"
            >
              <Lightbulb className="w-3 h-3" />
              {loadingWhy ? 'Thinking…' : 'Why it matters'}
            </button>
          )}

          {/* description — selectable for highlights */}
          <p
            ref={contentRef}
            onMouseUp={handleTextMouseUp}
            className="text-[12px] text-muted-foreground leading-relaxed select-text cursor-text"
          >
            {renderHighlightedContent(truncate(article.content || 'No content available'), highlights)}
          </p>
          {isSignedIn && (
            <p className="text-[10px] text-muted-foreground/40 -mt-1">
              Select any text above to highlight it
            </p>
          )}

          {/* Selection popover — rendered in a portal to escape backdrop-filter containment */}
          {selectionPopover && typeof document !== 'undefined' && createPortal(
            <div
              className="fixed z-[9999] -translate-x-1/2 -translate-y-full pointer-events-auto"
              style={{ left: selectionPopover.x, top: selectionPopover.y - 8 }}
              onMouseDown={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 shadow-2xl border border-white/10">
                <Highlighter className="w-3 h-3 text-white/60 shrink-0" />
                {Object.entries(HL_COLORS).map(([color, { dot }]) => (
                  <button
                    key={color}
                    onClick={() => handleHighlightSave(color)}
                    className={`w-4 h-4 rounded-full ${dot} hover:scale-125 transition-transform shadow-sm`}
                    title={color}
                  />
                ))}
                <button
                  onClick={() => { setSelectionPopover(null); window.getSelection()?.removeAllRanges() }}
                  className="ml-1 text-white/40 hover:text-white/80 text-[10px] transition-colors"
                >✕</button>
              </div>
              <div className="flex justify-center"><div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-900" /></div>
            </div>,
            document.body
          )}

          {/* hashtags */}
          {article.hashtags && (
            <div className="flex flex-wrap gap-1">
              {article.hashtags.split(/\s+/).filter(t=>t.startsWith('#')).slice(0,3).map((tag,i)=>(
                <span key={i} className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 cursor-pointer transition-all px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200/70 dark:border-indigo-400/25 hover:bg-indigo-100 dark:hover:bg-indigo-500/25 hover:text-indigo-700 dark:hover:text-indigo-300">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* entities — brighter per-type chips */}
          {article.entities && (() => {
            try {
              const ents: Entity[] = JSON.parse(article.entities)
              if (!ents.length) return null
              return (
                <div className="flex flex-wrap gap-1">
                  {ents.slice(0,4).map((e, i) => {
                    const Icon = ENTITY_ICON[e.type] ?? User
                    const cls  = ENTITY_CHIP[e.type] ?? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600'
                    return (
                      <span key={i} className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cls}`}>
                        <Icon className="w-2.5 h-2.5 shrink-0" />{e.name}
                      </span>
                    )
                  })}
                </div>
              )
            } catch { return null }
          })()}

          <div className="flex-1" />

          {/* toolbar — contrasting pill container */}
          <div className="flex items-center gap-1 flex-wrap px-2.5 py-2 -mx-1 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.07] dark:border-white/[0.09]">
            <Tooltip label={userReaction==='upvote' ? 'Remove upvote' : 'Upvote'}>
              <button
                onClick={()=>handleReaction('upvote')} disabled={loadingRx}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  userReaction==='upvote'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.07]'
                }`}
              >
                <ThumbsUp className="w-3 h-3" />{upvotes}
              </button>
            </Tooltip>
            <Tooltip label={userReaction==='downvote' ? 'Remove downvote' : 'Downvote'}>
              <button
                onClick={()=>handleReaction('downvote')} disabled={loadingRx}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all mr-1 ${
                  userReaction==='downvote'
                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                    : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.07]'
                }`}
              >
                <ThumbsDown className="w-3 h-3" />{downvotes}
              </button>
            </Tooltip>

            <GlassIconBtn onClick={handleSpeak} active={isSpeaking} title={isSpeaking ? 'Stop reading' : 'Listen aloud'}>
              {isSpeaking ? <Square className="w-3.5 h-3.5 fill-current" /> : <Volume2 className="w-3.5 h-3.5" />}
            </GlassIconBtn>
            <GlassIconBtn onClick={handleBookmark} active={isBookmarked} disabled={loadingBM} title={isBookmarked ? 'Remove bookmark' : 'Save article'}>
              <Bookmark className={`w-3.5 h-3.5 ${isBookmarked?'fill-current':''}`} />
            </GlassIconBtn>
            {/* Folder assignment — only when bookmarked */}
            {isBookmarked && (
              <div className="relative" onMouseDown={e => e.stopPropagation()}>
                <Tooltip label={activeFolderId ? 'Move to folder' : 'Add to folder'}>
                  <button
                    onClick={handleOpenFolderPicker}
                    className={`relative p-1.5 rounded-lg transition-all ${
                      activeFolderId
                        ? 'bg-violet-500/15 text-violet-600 dark:text-violet-400'
                        : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.06] dark:hover:bg-white/[0.08]'
                    }`}
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
                {showFolderPicker && (
                  <div className="absolute bottom-full left-0 mb-2 z-50 w-52 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-2xl shadow-black/[0.12] dark:shadow-black/[0.40] border border-white/60 dark:border-white/[0.10] overflow-hidden">
                    {/* header */}
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border-b border-indigo-100/60 dark:border-white/[0.06]">
                      <div className="flex items-center justify-center w-5 h-5 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm shadow-indigo-500/30">
                        <FolderOpen className="w-3 h-3 text-white" />
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Move to folder</p>
                    </div>

                    {loadingFolders ? (
                      <div className="px-3 py-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <div className="w-3 h-3 rounded-full border-2 border-indigo-400/40 border-t-indigo-500 animate-spin shrink-0" />
                        Loading…
                      </div>
                    ) : (
                      <div className="py-1.5">
                        <button
                          onClick={() => handleAssignFolder(null)}
                          className={`w-full flex items-center justify-between px-3 py-2 text-[11px] transition-colors group ${activeFolderId === null ? 'bg-indigo-500/[0.08]' : 'hover:bg-indigo-500/[0.06]'}`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full transition-colors ${activeFolderId === null ? 'bg-indigo-500' : 'bg-muted-foreground/25 group-hover:bg-indigo-400/50'}`} />
                            <span className={`font-medium ${activeFolderId === null ? 'text-indigo-600 dark:text-indigo-400' : 'text-foreground'}`}>
                              No folder
                            </span>
                          </div>
                          {activeFolderId === null && <Check className="w-3 h-3 text-indigo-500" />}
                        </button>

                        {folders.length === 0 ? (
                          <p className="px-3 py-2 text-[11px] text-muted-foreground/60 italic">
                            No folders — create one in Profile
                          </p>
                        ) : (
                          <>
                            <div className="mx-3 my-1 h-px bg-border/50" />
                            {folders.map(f => (
                              <button
                                key={f.id}
                                onClick={() => handleAssignFolder(f.id)}
                                className={`w-full flex items-center justify-between px-3 py-2 text-[11px] transition-colors group ${activeFolderId === f.id ? 'bg-violet-500/[0.08]' : 'hover:bg-violet-500/[0.06]'}`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${activeFolderId === f.id ? 'bg-violet-500' : 'bg-muted-foreground/25 group-hover:bg-violet-400/50'}`} />
                                  <span className={`truncate font-medium ${activeFolderId === f.id ? 'text-violet-600 dark:text-violet-400' : 'text-foreground'}`}>
                                    {f.name}
                                  </span>
                                </div>
                                {activeFolderId === f.id && <Check className="w-3 h-3 text-violet-500 shrink-0" />}
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <Tooltip label="Share">
              <ShareableImage
                title={article.title}
                description={article.content || ''}
                imageUrl={article.imageUrl || ''}
                category={article.category || 'News'}
              />
            </Tooltip>
            <GlassIconBtn onClick={() => { if (!isSignedIn) { requireAuth(); return }; setShowComments(v=>!v) }} active={showComments} title="Comments">
              <MessageSquare className="w-3.5 h-3.5" />
            </GlassIconBtn>
            <GlassIconBtn onClick={handleShowHighlights} active={showHighlights} title="My highlights">
              <Highlighter className="w-3.5 h-3.5" />
              {highlights.length > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-400 text-[8px] font-black text-white flex items-center justify-center leading-none">{highlights.length}</span>
              )}
            </GlassIconBtn>
            <GlassIconBtn onClick={handleToggleQuestions} active={showQuestions} disabled={loadingQA} title="AI questions">
              <HelpCircle className="w-3.5 h-3.5" />
            </GlassIconBtn>
            <GlassIconBtn onClick={handleSimilar} title="Similar articles">
              {showSimilar ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </GlassIconBtn>

            <Tooltip label="Read full article">
              <a
                href={article.url} target="_blank" rel="noopener noreferrer"
                className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-gradient-to-r ${catGrad} text-white hover:opacity-90 transition-opacity shadow-md whitespace-nowrap`}
              >
                Read <ExternalLink className="w-3 h-3" />
              </a>
            </Tooltip>
          </div>

          {/* comments */}
          {showComments && <CommentSection articleId={article.id} />}

          {/* highlights panel */}
          {showHighlights && (
            <div className="pt-2 border-t border-border/60 space-y-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">My Highlights</p>
              {highlights.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">Select any text above to save a highlight.</p>
              ) : (
                <ul className="space-y-1.5">
                  {highlights.map(h => (
                    <li key={h.id} className={`flex items-start justify-between gap-2 px-2 py-1.5 rounded-lg ${HL_COLORS[h.color]?.bg ?? HL_COLORS.yellow.bg}`}>
                      <span className="text-[11px] text-foreground leading-snug flex-1">&ldquo;{h.text}&rdquo;</span>
                      <button
                        onClick={() => handleDeleteHighlight(h.id)}
                        className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Q&A panel */}
          {showQuestions && (
            <div className="pt-2 border-t border-border/60 space-y-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">AI Questions</p>
              {loadingQA ? (
                <p className="text-[11px] text-muted-foreground">Generating…</p>
              ) : !questions || questions.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">No questions generated for this article.</p>
              ) : (
                <ul className="space-y-2.5">
                  {questions.map((item, i) => (
                    <li key={i} className="space-y-0.5">
                      <p className="text-[11px] font-semibold text-foreground leading-snug">{item.q}</p>
                      <p className="text-[11px] text-muted-foreground leading-snug pl-2 border-l-2 border-indigo-400/40">{item.a}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* similar articles */}
          {showSimilar && (
            <div className="pt-2 border-t border-border/60 space-y-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">Similar</p>
              {loadingSim ? <p className="text-[11px] text-muted-foreground">Loading…</p>
               : similar.length === 0 ? <p className="text-[11px] text-muted-foreground">No similar articles found.</p>
               : (
                <ul className="space-y-1.5">
                  {similar.map(s => (
                    <li key={s.id}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="flex gap-2 items-start group/sim">
                        {s.category && (
                          <span className={`flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md ${CATEGORY_COLORS[s.category] ?? 'bg-slate-100 dark:bg-slate-800 text-muted-foreground'}`}>
                            {s.category}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground group-hover/sim:text-foreground line-clamp-2 transition-colors">{s.title}</span>
                      </a>
                    </li>
                  ))}
                </ul>
               )}
            </div>
          )}
        </div>
      </article>
    </div>
  )
}

function Tooltip({ children, label }: { children: React.ReactNode; label: string }) {
  if (!label) return <>{children}</>
  return (
    <div className="relative group/tt inline-flex">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 dark:bg-slate-700 text-white text-[10px] font-medium rounded-lg whitespace-nowrap opacity-0 group-hover/tt:opacity-100 transition-opacity duration-150 pointer-events-none z-50 shadow-lg">
        {label}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900 dark:border-t-slate-700" />
      </div>
    </div>
  )
}

function GlassIconBtn({ children, onClick, title, active = false, disabled = false }: {
  children: React.ReactNode; onClick: () => void; title?: string; active?: boolean; disabled?: boolean
}) {
  return (
    <Tooltip label={title || ''}>
      <button
        onClick={onClick} disabled={disabled}
        className={`relative p-1.5 rounded-lg transition-all ${
          active
            ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
            : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.06] dark:hover:bg-white/[0.08]'
        }`}
      >
        {children}
      </button>
    </Tooltip>
  )
}
