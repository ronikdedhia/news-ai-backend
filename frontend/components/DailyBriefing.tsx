'use client'

import { useState, useRef } from 'react'
import { Play, Pause, SkipBack, SkipForward, GripHorizontal, ChevronDown, Headphones } from 'lucide-react'
import { Article } from '@/lib/api'

const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const
type Speed = typeof SPEEDS[number]

interface DailyBriefingProps {
  articles: Article[]
}

export function DailyBriefing({ articles }: DailyBriefingProps) {
  const TOP = articles.slice(0, 5)

  const [minimized, setMinimized]        = useState(false)
  const [isPlaying, setIsPlaying]        = useState(false)
  const [currentIndex, setCurrentIndex]  = useState(0)
  const [speed, setSpeed]                = useState<Speed>(1)
  const [seekPct, setSeekPct]            = useState(0)

  const playerRef  = useRef<HTMLDivElement>(null)
  const seekBarRef = useRef<HTMLDivElement>(null)
  const dragRef    = useRef({ active: false, startMX: 0, startMY: 0, startEX: 0, startEY: 0 })
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  // playback refs
  const indexRef       = useRef(0)
  const speedRef       = useRef<Speed>(1)
  const activeRef      = useRef(false)
  const isPausedRef    = useRef(false)
  const isPlayingRef   = useRef(false)
  const fullTextRef    = useRef('')
  const charOffsetRef  = useRef(0)
  const seekPctRef     = useRef(0)  // mirrors seekPct state for use inside cycleSpeed
  const keepAliveRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  if (TOP.length === 0) return null

  const buildText = (idx: number): string => {
    const a = TOP[idx]
    return idx === 0
      ? `Daily Briefing. ${TOP.length} articles. Article ${idx + 1}: ${a.title}. ${a.content || ''}`
      : `Article ${idx + 1}: ${a.title}. ${a.content || ''}`
  }

  const clearKeepAlive = () => {
    if (keepAliveRef.current) { clearInterval(keepAliveRef.current); keepAliveRef.current = null }
  }

  const speakSegment = (text: string, charOffset: number, rate: Speed) => {
    const u = new SpeechSynthesisUtterance(text)
    u.rate   = rate
    u.pitch  = 1
    u.volume = 1
    const voices = window.speechSynthesis.getVoices()
    const voice = voices.find(v => v.lang.startsWith('en-') && !v.localService)
      ?? voices.find(v => v.lang.startsWith('en'))
      ?? voices[0]
    if (voice) u.voice = voice

    u.onstart = () => {
      // Chrome pauses utterances after ~15s; call resume() every 10s to prevent that
      clearKeepAlive()
      keepAliveRef.current = setInterval(() => {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.resume()
        }
      }, 10000)
    }

    u.onboundary = (e) => {
      if (e.name !== 'word') return
      const abs = charOffset + e.charIndex
      const pct = fullTextRef.current.length ? abs / fullTextRef.current.length : 0
      seekPctRef.current = pct
      setSeekPct(pct)
    }

    u.onend = () => {
      clearKeepAlive()
      if (!activeRef.current) return
      const next = indexRef.current + 1
      if (next >= TOP.length) {
        activeRef.current    = false
        isPlayingRef.current = false
        setIsPlaying(false)
        setCurrentIndex(0); indexRef.current = 0
        seekPctRef.current = 0; setSeekPct(0)
      } else {
        indexRef.current = next
        setCurrentIndex(next)
        const t = buildText(next)
        fullTextRef.current   = t
        charOffsetRef.current = 0
        seekPctRef.current = 0; setSeekPct(0)
        speakSegment(t, 0, speedRef.current)
      }
    }

    u.onerror = (e) => {
      clearKeepAlive()
      if (e.error === 'interrupted' || e.error === 'canceled') return
      activeRef.current    = false
      isPlayingRef.current = false
      setIsPlaying(false)
    }

    window.speechSynthesis.speak(u)
  }

  // Wraps cancel() + delayed speak — Chrome silently fails if speak() follows cancel() immediately
  const cancelThenSpeak = (text: string, charOffset: number, rate: Speed) => {
    clearKeepAlive()
    window.speechSynthesis.cancel()
    setTimeout(() => {
      window.speechSynthesis.resume()
      const voices = window.speechSynthesis.getVoices()
      if (voices.length > 0) {
        speakSegment(text, charOffset, rate)
      } else {
        window.speechSynthesis.addEventListener('voiceschanged', () => speakSegment(text, charOffset, rate), { once: true })
      }
    }, 120)
  }

  const playFrom = (idx: number, rate: Speed = speedRef.current) => {
    if (idx < 0 || idx >= TOP.length) return
    isPausedRef.current  = false
    activeRef.current    = true
    isPlayingRef.current = true
    indexRef.current     = idx
    setCurrentIndex(idx)
    const t = buildText(idx)
    fullTextRef.current   = t
    charOffsetRef.current = 0
    seekPctRef.current = 0; setSeekPct(0)
    setIsPlaying(true)
    cancelThenSpeak(t, 0, rate)
  }

  const stopAll = () => {
    clearKeepAlive()
    activeRef.current    = false
    isPausedRef.current  = false
    isPlayingRef.current = false
    window.speechSynthesis.cancel()
  }

  const handlePlayPause = () => {
    if (isPlaying) {
      // Cancel and remember position (Chrome pause() is unreliable)
      clearKeepAlive()
      window.speechSynthesis.cancel()
      isPausedRef.current  = true
      isPlayingRef.current = false
      setIsPlaying(false)
    } else if (isPausedRef.current) {
      // Resume from saved seek position
      const absChar   = Math.floor(seekPctRef.current * fullTextRef.current.length)
      const remaining = fullTextRef.current.substring(absChar)
      isPausedRef.current  = false
      isPlayingRef.current = true
      activeRef.current    = true
      setIsPlaying(true)
      cancelThenSpeak(remaining, absChar, speedRef.current)
    } else {
      isPausedRef.current = false
      playFrom(currentIndex)
    }
  }

  const handlePrev = () => {
    const t = Math.max(0, currentIndex - 1)
    if (isPlayingRef.current || isPausedRef.current) playFrom(t)
    else { setCurrentIndex(t); indexRef.current = t; seekPctRef.current = 0; setSeekPct(0) }
  }
  const handleNext = () => {
    const t = Math.min(TOP.length - 1, currentIndex + 1)
    if (isPlayingRef.current || isPausedRef.current) playFrom(t)
    else { setCurrentIndex(t); indexRef.current = t; seekPctRef.current = 0; setSeekPct(0) }
  }

  /* speed — applies immediately by restarting from current seek position */
  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]
    speedRef.current = next
    setSpeed(next)

    if (isPlayingRef.current && fullTextRef.current) {
      const absChar = Math.floor(seekPctRef.current * fullTextRef.current.length)
      const remaining = fullTextRef.current.substring(absChar)
      isPausedRef.current   = false
      charOffsetRef.current = absChar
      cancelThenSpeak(remaining, absChar, next)
    }
  }

  const seekTo = (clientX: number) => {
    if (!seekBarRef.current || !fullTextRef.current) return
    const rect  = seekBarRef.current.getBoundingClientRect()
    const pct   = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const targetChar = Math.floor(fullTextRef.current.length * pct)
    const remaining  = fullTextRef.current.substring(targetChar)
    const wasActive  = isPlayingRef.current || isPausedRef.current

    isPausedRef.current   = false
    charOffsetRef.current = targetChar
    seekPctRef.current = pct; setSeekPct(pct)

    if (wasActive) {
      activeRef.current    = true
      isPlayingRef.current = true
      setIsPlaying(true)
      cancelThenSpeak(remaining, targetChar, speedRef.current)
    } else {
      window.speechSynthesis.cancel()
    }
  }

  const onSeekMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    seekTo(e.clientX)
    const onMove = (ev: MouseEvent) => seekTo(ev.clientX)
    const onUp   = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const onDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const rect = playerRef.current!.getBoundingClientRect()
    dragRef.current = { active: true, startMX: e.clientX, startMY: e.clientY, startEX: rect.left, startEY: rect.top }
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current.active) return
      setPos({
        x: Math.max(0, Math.min(window.innerWidth  - 296, dragRef.current.startEX + (e.clientX - dragRef.current.startMX))),
        y: Math.max(0, Math.min(window.innerHeight - 160, dragRef.current.startEY + (e.clientY - dragRef.current.startMY))),
      })
    }
    const onUp = () => { dragRef.current.active = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  /* ── mini-player (when minimized) ── */
  if (minimized) {
    const miniStyle: React.CSSProperties = pos
      ? { position: 'fixed', left: pos.x, top: pos.y, right: 'auto', bottom: 'auto', zIndex: 200 }
      : { position: 'fixed', right: 24, bottom: 24, zIndex: 200 }

    return (
      <div style={miniStyle} className="select-none">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-600 to-purple-600 shadow-xl shadow-indigo-500/30">
          {/* pulsing dot when playing */}
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isPlaying ? 'bg-white animate-pulse' : 'bg-white/40'}`} />
          <button
            onClick={() => setMinimized(false)}
            className="flex items-center gap-1.5 text-white"
            title="Expand Daily Briefing"
          >
            <Headphones className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold max-w-[120px] truncate">
              {TOP[currentIndex]?.title ?? 'Daily Briefing'}
            </span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handlePlayPause() }}
            className="p-1 rounded-full bg-white/20 hover:bg-white/35 text-white transition-colors"
          >
            {isPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current ml-px" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); stopAll(); setIsPlaying(false) }}
            className="p-1 rounded text-white/50 hover:text-white transition-colors text-[10px] font-bold"
            title="Stop"
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  /* ── full player ── */
  const containerStyle: React.CSSProperties = pos
    ? { position: 'fixed', left: pos.x, top: pos.y, right: 'auto', bottom: 'auto', zIndex: 200, width: 296 }
    : { position: 'fixed', right: 24, bottom: 80, zIndex: 200, width: 296 }

  return (
    <div ref={playerRef} style={containerStyle} className="select-none">
      <div className="rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-600 to-purple-600 shadow-2xl shadow-indigo-500/30 overflow-hidden">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

        <div className="relative px-4 py-3 space-y-2.5">

          {/* row 1: drag + label + speed + minimize */}
          <div className="flex items-center gap-2">
            <div onMouseDown={onDragStart} className="cursor-grab active:cursor-grabbing text-white/40 hover:text-white/70 transition-colors" title="Drag to move">
              <GripHorizontal className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/60 flex-1">Daily Briefing</span>
            <button
              onClick={cycleSpeed}
              className="px-2 py-0.5 rounded-md bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold transition-colors tabular-nums"
              title="Change playback speed"
            >
              {speed}×
            </button>
            <button onClick={() => setMinimized(true)} className="p-1 rounded-md text-white/50 hover:text-white hover:bg-white/15 transition-colors" title="Minimize">
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* row 2: title */}
          <p className="text-[13px] font-semibold text-white leading-snug line-clamp-2 min-h-[2.5rem]">
            {TOP[currentIndex]?.title ?? ''}
          </p>

          {/* row 3: seekable progress bar */}
          <div>
            <div
              ref={seekBarRef}
              onMouseDown={onSeekMouseDown}
              className="h-1.5 rounded-full bg-white/20 cursor-pointer hover:h-2.5 transition-all duration-150"
              title="Click or drag to seek"
            >
              <div className="h-full rounded-full bg-white/80" style={{ width: `${seekPct * 100}%`, transition: 'width 0.1s linear' }} />
            </div>
            <div className="flex justify-between mt-0.5 text-[10px] text-white/40 tabular-nums">
              <span>{currentIndex + 1} / {TOP.length}</span>
              <span>{speed}× speed</span>
            </div>
          </div>

          {/* row 4: transport + article dots */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button onClick={handlePrev} disabled={currentIndex === 0} className="p-1.5 rounded-lg text-white disabled:opacity-25 hover:bg-white/15 transition-colors">
                <SkipBack className="w-4 h-4 fill-current" />
              </button>
              <button onClick={handlePlayPause} className="flex items-center justify-center w-9 h-9 rounded-full bg-white text-indigo-600 hover:scale-105 active:scale-95 transition-transform shadow-md shadow-black/20 mx-1">
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>
              <button onClick={handleNext} disabled={currentIndex === TOP.length - 1} className="p-1.5 rounded-lg text-white disabled:opacity-25 hover:bg-white/15 transition-colors">
                <SkipForward className="w-4 h-4 fill-current" />
              </button>
            </div>

            <div className="flex items-center gap-1">
              {TOP.map((_, i) => (
                <button
                  key={i}
                  onClick={() => (isPlayingRef.current || isPausedRef.current) ? playFrom(i) : (setCurrentIndex(i), indexRef.current = i, seekPctRef.current = 0, setSeekPct(0))}
                  className={`rounded-full transition-all duration-300 ${i === currentIndex ? 'w-4 h-1.5 bg-white' : i < currentIndex ? 'w-1.5 h-1.5 bg-white/55' : 'w-1.5 h-1.5 bg-white/25'}`}
                />
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
