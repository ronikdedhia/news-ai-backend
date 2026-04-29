'use client'

import { useState, useEffect, useRef } from 'react'
import { TrendingUp, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { getTrendingHashtags } from '@/lib/api'

interface Props {
  onSelect: (tag: string) => void
  selectedTag?: string | null
}

export function TrendingHashtags({ onSelect, selectedTag }: Props) {
  const [tags, setTags]       = useState<{ tag: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [canLeft, setCanLeft]   = useState(false)
  const [canRight, setCanRight] = useState(false)
  const stripRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getTrendingHashtags(48).then(data => { setTags(data); setLoading(false) })
  }, [])

  const updateArrows = () => {
    const el = stripRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }

  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    updateArrows()
    el.addEventListener('scroll', updateArrows, { passive: true })
    const ro = new ResizeObserver(updateArrows)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', updateArrows); ro.disconnect() }
  }, [tags])

  const scroll = (dir: 'left' | 'right') => {
    stripRef.current?.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' })
  }

  if (!loading && tags.length === 0) return null

  return (
    <div className="flex items-center gap-2 min-w-0">
      {/* label */}
      <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
        <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
        <span className="text-[11px] font-bold uppercase tracking-widest hidden sm:inline">Trending</span>
      </div>

      {/* left arrow */}
      <button
        onClick={() => scroll('left')}
        className={`shrink-0 p-1 rounded-full transition-all ${canLeft ? 'text-muted-foreground hover:text-foreground hover:bg-black/[0.06] dark:hover:bg-white/[0.08]' : 'opacity-0 pointer-events-none'}`}
        aria-hidden={!canLeft}
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>

      {/* scrollable strip */}
      <div
        ref={stripRef}
        className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide min-w-0 flex-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shrink-0 h-6 rounded-full bg-black/[0.05] dark:bg-white/[0.07] animate-pulse" style={{ width: 60 + (i % 3) * 20 }} />
            ))
          : tags.map(({ tag, count }) => {
              const active = selectedTag === tag
              return (
                <button
                  key={tag}
                  onClick={() => onSelect(tag)}
                  className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all duration-150 whitespace-nowrap ${
                    active
                      ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30'
                      : 'bg-black/[0.05] dark:bg-white/[0.07] text-muted-foreground hover:text-foreground hover:bg-black/[0.09] dark:hover:bg-white/[0.12]'
                  }`}
                >
                  {tag}
                  {active ? (
                    <span
                      role="button"
                      onClick={e => { e.stopPropagation(); onSelect(tag) }}
                      className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-white/25 hover:bg-white/45 transition-colors ml-0.5"
                      title="Clear filter"
                    >
                      <X className="w-2 h-2 text-white" />
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold tabular-nums text-muted-foreground/50">
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
      </div>

      {/* right arrow */}
      <button
        onClick={() => scroll('right')}
        className={`shrink-0 p-1 rounded-full transition-all ${canRight ? 'text-muted-foreground hover:text-foreground hover:bg-black/[0.06] dark:hover:bg-white/[0.08]' : 'opacity-0 pointer-events-none'}`}
        aria-hidden={!canRight}
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
