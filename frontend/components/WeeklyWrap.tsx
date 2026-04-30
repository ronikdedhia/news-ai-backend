'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import html2canvas from 'html2canvas'
import { X, Download, Copy, Twitter, Linkedin, BarChart2, Flame, BookmarkIcon, ThumbsUp, Sparkles } from 'lucide-react'
import { getWeeklyWrap, WeeklyWrap } from '@/lib/api'

const CATEGORY_EMOJI: Record<string, string> = {
  technology: '💻', business: '💼', sports: '⚽', entertainment: '🎬',
  health: '🏥', science: '🔬', education: '📚', politics: '🏛️',
  world: '🌍', nation: '🇮🇳',
}

function weekRange(): string {
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - 6)
  const fmt = (d: Date) => d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
  return `${fmt(start)} – ${fmt(now)}, ${now.getFullYear()}`
}

interface WeeklyWrapButtonProps {
  className?: string
}

export function WeeklyWrapButton({ className }: WeeklyWrapButtonProps) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<WeeklyWrap | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [mounted, setMounted] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  const openWrap = async () => {
    setOpen(true)
    if (data) return
    setLoading(true)
    setError(null)
    try {
      const wrap = await getWeeklyWrap()
      setData(wrap)
    } catch {
      setError('Failed to load your weekly stats.')
    } finally {
      setLoading(false)
    }
  }

  const capture = useCallback(async () => {
    if (!cardRef.current) return null
    return html2canvas(cardRef.current, {
      backgroundColor: null, scale: 2, useCORS: true,
      allowTaint: true, width: 400, windowWidth: 400, logging: false,
    })
  }, [])

  const download = async () => {
    setCapturing(true)
    try {
      const canvas = await capture()
      if (!canvas) return
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = `daily-bytes-weekly-wrap-${Date.now()}.png`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
    } catch (e) { console.error(e) } finally { setCapturing(false) }
  }

  const copyImage = async () => {
    setCapturing(true)
    try {
      const canvas = await capture()
      if (!canvas) return
      canvas.toBlob(blob => {
        if (blob) navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      })
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch (e) { console.error(e) } finally { setCapturing(false) }
  }

  return (
    <>
      <button
        onClick={openWrap}
        title="Your Weekly Wrap"
        className={className}
      >
        <BarChart2 className="w-4 h-4" />
      </button>

      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="glass-strong rounded-3xl w-full max-w-md overflow-hidden shadow-2xl shadow-black/30 animate-in fade-in zoom-in-95 duration-200">

            {/* modal header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-500" />
                <h2 className="text-lg font-bold">Your Weekly Wrap</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-xl hover:bg-black/[0.05] dark:hover:bg-white/[0.07] text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* card preview */}
            <div className="px-6 pb-4">
              {loading && (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-500" />
                </div>
              )}
              {error && (
                <div className="text-center py-12 text-muted-foreground text-sm">{error}</div>
              )}
              {data && (
                <div ref={cardRef} style={{ width: '100%', maxWidth: 400, borderRadius: 20, overflow: 'hidden' }}>
                  {/* gradient background card */}
                  <div style={{ background: 'linear-gradient(135deg, #312e81 0%, #4c1d95 40%, #1e1b4b 100%)', padding: '24px 24px 20px' }}>

                    {/* top row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                      <div>
                        <p style={{ color: '#a5b4fc', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 2 }}>Daily Bytes</p>
                        <p style={{ color: 'white', fontSize: 22, fontWeight: 900, lineHeight: 1.1 }}>Your Week<br />in News</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ color: '#c4b5fd', fontSize: 10, fontWeight: 600 }}>{weekRange()}</p>
                        {data.firstName && (
                          <p style={{ color: '#e9d5ff', fontSize: 12, fontWeight: 700, marginTop: 4 }}>Hey, {data.firstName}!</p>
                        )}
                      </div>
                    </div>

                    {/* stats grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                      <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 16px' }}>
                        <p style={{ color: '#a5b4fc', fontSize: 10, fontWeight: 600, marginBottom: 4 }}>📰 ARTICLES VIEWED</p>
                        <p style={{ color: 'white', fontSize: 32, fontWeight: 900, lineHeight: 1 }}>{data.articlesViewed}</p>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 16px' }}>
                        <p style={{ color: '#a5b4fc', fontSize: 10, fontWeight: 600, marginBottom: 4 }}>🔥 DAY STREAK</p>
                        <p style={{ color: 'white', fontSize: 32, fontWeight: 900, lineHeight: 1 }}>{data.streak}</p>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 16px' }}>
                        <p style={{ color: '#a5b4fc', fontSize: 10, fontWeight: 600, marginBottom: 4 }}>👍 REACTIONS</p>
                        <p style={{ color: 'white', fontSize: 32, fontWeight: 900, lineHeight: 1 }}>{data.reactionsThisWeek}</p>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 16px' }}>
                        <p style={{ color: '#a5b4fc', fontSize: 10, fontWeight: 600, marginBottom: 4 }}>🔖 BOOKMARKS</p>
                        <p style={{ color: 'white', fontSize: 32, fontWeight: 900, lineHeight: 1 }}>{data.bookmarksThisWeek}</p>
                      </div>
                    </div>

                    {/* top category + hashtag */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                      {data.topCategory && (
                        <div style={{ flex: 1, background: 'rgba(139,92,246,0.3)', border: '1px solid rgba(139,92,246,0.5)', borderRadius: 10, padding: '8px 12px' }}>
                          <p style={{ color: '#c4b5fd', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Top Category</p>
                          <p style={{ color: 'white', fontSize: 13, fontWeight: 800 }}>
                            {CATEGORY_EMOJI[data.topCategory.toLowerCase()] ?? '📰'} {data.topCategory.charAt(0).toUpperCase() + data.topCategory.slice(1)}
                          </p>
                        </div>
                      )}
                      {data.topHashtag && (
                        <div style={{ flex: 1, background: 'rgba(99,102,241,0.3)', border: '1px solid rgba(99,102,241,0.5)', borderRadius: 10, padding: '8px 12px' }}>
                          <p style={{ color: '#c4b5fd', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Top Topic</p>
                          <p style={{ color: 'white', fontSize: 13, fontWeight: 800 }}>{data.topHashtag}</p>
                        </div>
                      )}
                    </div>

                    {/* footer */}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12, textAlign: 'center' }}>
                      <p style={{ color: '#7c3aed', fontSize: 11, fontWeight: 800, letterSpacing: '0.05em' }}>dailybytes.app</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* actions */}
            {data && (
              <>
                <div className="px-6 pb-4 flex gap-2">
                  <button
                    onClick={download} disabled={capturing}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-md shadow-indigo-500/25"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {capturing ? 'Saving…' : 'Save Image'}
                  </button>
                  <button
                    onClick={copyImage} disabled={capturing}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl glass border border-white/40 text-foreground text-xs font-semibold hover:bg-white/80 dark:hover:bg-white/10 transition-all"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                <div className="px-6 pb-5 pt-1 border-t border-black/[0.05] dark:border-white/[0.06]">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-3">Share on</p>
                  <div className="flex gap-2">
                    {[
                      {
                        href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`My week in news on Daily Bytes 📰\n🔥 ${data.streak} day streak | 📰 ${data.articlesViewed} articles\n${data.topCategory ? `Top category: ${data.topCategory}` : ''}`)}`,
                        label: 'X / Twitter',
                        icon: <Twitter className="w-4 h-4" />,
                        color: 'hover:bg-slate-100 dark:hover:bg-slate-800',
                      },
                      {
                        href: `https://www.linkedin.com/shareArticle?mini=true&title=${encodeURIComponent('My Weekly News Wrap on Daily Bytes')}`,
                        label: 'LinkedIn',
                        icon: <Linkedin className="w-4 h-4" />,
                        color: 'hover:bg-blue-50 dark:hover:bg-blue-950/30',
                      },
                    ].map(({ href, label, icon, color }) => (
                      <a key={label} href={href} target="_blank" rel="noopener noreferrer" title={label}
                        className={`flex-1 flex items-center justify-center p-2.5 rounded-xl glass transition-colors text-muted-foreground hover:text-foreground ${color}`}
                      >
                        {icon}
                      </a>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
