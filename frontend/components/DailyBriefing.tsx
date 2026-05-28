'use client'

import { useState, useRef } from 'react'
import { Play, Pause, SkipBack, SkipForward, GripHorizontal, ChevronDown, Headphones } from 'lucide-react'
import { useAuth } from '@clerk/nextjs'
import { Article, synthesizeSpeech } from '@/lib/api'

const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const
type Speed = typeof SPEEDS[number]

interface DailyBriefingProps {
  articles: Article[]
}

export function DailyBriefing({ articles }: DailyBriefingProps) {
  const TOP = articles.slice(0, 5)
  const { getToken } = useAuth()

  const [minimized, setMinimized]       = useState(false)
  const [isPlaying, setIsPlaying]       = useState(false)
  const [isLoading, setIsLoading]       = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [speed, setSpeed]               = useState<Speed>(1)
  const [seekPct, setSeekPct]           = useState(0)

  const playerRef  = useRef<HTMLDivElement>(null)
  const seekBarRef = useRef<HTMLDivElement>(null)
  const dragRef    = useRef({ active: false, startMX: 0, startMY: 0, startEX: 0, startEY: 0 })
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  const audioRef    = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const indexRef    = useRef(0)
  const speedRef    = useRef<Speed>(1)
  const activeRef   = useRef(false)
  const utterRef    = useRef<SpeechSynthesisUtterance | null>(null)

  if (TOP.length === 0) return null

  const buildText = (idx: number): string => {
    const a = TOP[idx]
    return idx === 0
      ? `Daily Briefing. ${TOP.length} articles. Article ${idx + 1}: ${a.title}. ${a.content || ''}`
      : `Article ${idx + 1}: ${a.title}. ${a.content || ''}`
  }

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current.ontimeupdate = null
      audioRef.current = null
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
    if (utterRef.current) {
      window.speechSynthesis.cancel()
      utterRef.current = null
    }
  }

  const fetchAndPlay = async (idx: number) => {
    if (idx < 0 || idx >= TOP.length) return

    stopAudio()
    activeRef.current = true
    indexRef.current  = idx
    setCurrentIndex(idx)
    setSeekPct(0)
    setIsLoading(true)
    setIsPlaying(false)

    try {
      const token = await getToken()
      if (!token || !activeRef.current) return
      const blob = await synthesizeSpeech(buildText(idx), token)
      if (!activeRef.current) { URL.revokeObjectURL(URL.createObjectURL(blob)); return }

      const url = URL.createObjectURL(blob)
      audioUrlRef.current = url

      const audio = new Audio(url)
      audio.playbackRate = speedRef.current
      audioRef.current = audio

      audio.ontimeupdate = () => {
        if (audio.duration) setSeekPct(audio.currentTime / audio.duration)
      }

      audio.onended = () => {
        URL.revokeObjectURL(url)
        audioUrlRef.current = null
        audioRef.current = null
        const next = indexRef.current + 1
        if (next < TOP.length && activeRef.current) {
          fetchAndPlay(next)
        } else {
          activeRef.current = false
          setIsPlaying(false)
          setCurrentIndex(0); indexRef.current = 0
          setSeekPct(0)
        }
      }

      audio.onerror = () => {
        URL.revokeObjectURL(url)
        audioUrlRef.current = null
        audioRef.current = null
        activeRef.current = false
        setIsPlaying(false)
      }

      setIsLoading(false)
      setIsPlaying(true)
      audio.play()
    } catch {
      // ElevenLabs unavailable — fall back to browser SpeechSynthesis
      if (!activeRef.current) return
      const utter = new SpeechSynthesisUtterance(buildText(idx))
      utter.rate = speedRef.current
      utter.onend = () => {
        utterRef.current = null
        const next = indexRef.current + 1
        if (next < TOP.length && activeRef.current) {
          fetchAndPlay(next)
        } else {
          activeRef.current = false
          setIsPlaying(false)
          setCurrentIndex(0); indexRef.current = 0
        }
      }
      utter.onerror = () => {
        utterRef.current = null
        activeRef.current = false
        setIsPlaying(false)
      }
      utterRef.current = utter
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utter)
      setIsLoading(false)
      setIsPlaying(true)
    }
  }

  const stopAll = () => {
    activeRef.current = false
    stopAudio()
    setIsPlaying(false)
    setIsLoading(false)
  }

  const handlePlayPause = () => {
    if (isLoading) return

    if (isPlaying && audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else if (!isPlaying && audioRef.current) {
      audioRef.current.play()
      setIsPlaying(true)
    } else {
      fetchAndPlay(currentIndex)
    }
  }

  const handlePrev = () => {
    const t = Math.max(0, currentIndex - 1)
    if (activeRef.current || audioRef.current) fetchAndPlay(t)
    else { setCurrentIndex(t); indexRef.current = t; setSeekPct(0) }
  }

  const handleNext = () => {
    const t = Math.min(TOP.length - 1, currentIndex + 1)
    if (activeRef.current || audioRef.current) fetchAndPlay(t)
    else { setCurrentIndex(t); indexRef.current = t; setSeekPct(0) }
  }

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]
    speedRef.current = next
    setSpeed(next)
    if (audioRef.current) audioRef.current.playbackRate = next
    if (utterRef.current) {
      // browser TTS doesn't support live rate changes — restart current article at new speed
      window.speechSynthesis.cancel()
      fetchAndPlay(indexRef.current)
    }
  }

  const seekTo = (clientX: number) => {
    if (!seekBarRef.current || !audioRef.current || !audioRef.current.duration) return
    const rect = seekBarRef.current.getBoundingClientRect()
    const pct  = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    audioRef.current.currentTime = audioRef.current.duration * pct
    setSeekPct(pct)
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

  /* ── mini-player ── */
  if (minimized) {
    const miniStyle: React.CSSProperties = pos
      ? { position: 'fixed', left: pos.x, top: pos.y, right: 'auto', bottom: 'auto', zIndex: 200 }
      : { position: 'fixed', right: 24, bottom: 24, zIndex: 200 }

    return (
      <div style={miniStyle} className="select-none">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-600 to-purple-600 shadow-xl shadow-indigo-500/30">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isPlaying ? 'bg-white animate-pulse' : isLoading ? 'bg-white/60 animate-pulse' : 'bg-white/40'}`} />
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
            disabled={isLoading}
            className="p-1 rounded-full bg-white/20 hover:bg-white/35 text-white transition-colors disabled:opacity-50"
          >
            {isLoading
              ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
              : isPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current ml-px" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); stopAll() }}
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
              <button
                onClick={handlePlayPause}
                disabled={isLoading}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-white text-indigo-600 hover:scale-105 active:scale-95 transition-transform shadow-md shadow-black/20 mx-1 disabled:opacity-70"
              >
                {isLoading
                  ? <span className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin inline-block" />
                  : isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>
              <button onClick={handleNext} disabled={currentIndex === TOP.length - 1} className="p-1.5 rounded-lg text-white disabled:opacity-25 hover:bg-white/15 transition-colors">
                <SkipForward className="w-4 h-4 fill-current" />
              </button>
            </div>

            <div className="flex items-center gap-1">
              {TOP.map((_, i) => (
                <button
                  key={i}
                  onClick={() => (activeRef.current || audioRef.current) ? fetchAndPlay(i) : (setCurrentIndex(i), indexRef.current = i, setSeekPct(0))}
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
