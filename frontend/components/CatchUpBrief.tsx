'use client'

import { useEffect, useState } from 'react'
import { X, Newspaper, Loader2 } from 'lucide-react'
import { getCatchUpBrief, CatchUpBriefResponse } from '@/lib/api'

export function CatchUpBrief() {
  const [data, setData] = useState<CatchUpBriefResponse | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCatchUpBrief()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null
  if (!data?.shouldShow || dismissed) return null

  const daysAway = data.hoursAway && data.hoursAway >= 48
    ? `${Math.round(data.hoursAway / 24)} days`
    : `${data.hoursAway} hours`

  return (
    <div className="relative rounded-2xl overflow-hidden border border-indigo-200/60 dark:border-indigo-500/25 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/40 dark:to-violet-950/40 p-4 animate-in fade-in slide-in-from-top-2 duration-400">

      {/* dismiss */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 p-1 rounded-lg text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="flex gap-3 pr-6">
        {/* icon */}
        <div className="shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/25">
          <Newspaper className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
        </div>

        <div className="flex-1 min-w-0">
          {/* header */}
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
              You were away for {daysAway}
            </p>
            <span className="shrink-0 px-2 py-0.5 rounded-full bg-indigo-500 text-white text-[10px] font-bold">
              {data.count} new
            </span>
          </div>

          {/* summary */}
          {data.summary ? (
            <p className="text-[12px] text-indigo-800/80 dark:text-indigo-200/70 leading-relaxed">
              {data.summary}
            </p>
          ) : (
            <p className="text-[12px] text-indigo-600/60 dark:text-indigo-400/60">
              Scroll down to catch up on what you missed.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
