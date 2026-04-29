'use client'

import { useEffect } from 'react'
import { X, Keyboard } from 'lucide-react'

const SHORTCUTS = [
  { keys: ['j', '↓'], label: 'Next article' },
  { keys: ['k', '↑'], label: 'Previous article' },
  { keys: ['o', '↵'], label: 'Open article in new tab' },
  { keys: ['b'], label: 'Bookmark / unbookmark' },
  { keys: ['u'], label: 'Upvote' },
  { keys: ['d'], label: 'Downvote' },
  { keys: ['/'], label: 'Focus search' },
  { keys: ['Space', '?'], label: 'Show / hide shortcuts' },
  { keys: ['Esc'], label: 'Deselect / close' },
]

interface Props {
  onClose: () => void
}

export function KeyboardShortcutsHelp({ onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?' || e.key === ' ') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* panel */}
      <div
        className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-bold text-foreground">Keyboard Shortcuts</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* shortcuts list */}
        <div className="px-5 py-4 space-y-1">
          {SHORTCUTS.map(({ keys, label }) => (
            <div key={label} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-muted-foreground">{label}</span>
              <div className="flex items-center gap-1">
                {keys.map((k, i) => (
                  <span key={k} className="flex items-center gap-1">
                    <kbd className="px-2 py-0.5 rounded-md bg-black/[0.06] dark:bg-white/[0.10] text-foreground text-[11px] font-mono font-bold border border-black/[0.08] dark:border-white/[0.10] shadow-sm">
                      {k}
                    </kbd>
                    {i < keys.length - 1 && <span className="text-[10px] text-muted-foreground/50">or</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 pb-4">
          <p className="text-[11px] text-muted-foreground/60 text-center">
            Shortcuts inactive when typing in a text field
          </p>
        </div>
      </div>
    </div>
  )
}
