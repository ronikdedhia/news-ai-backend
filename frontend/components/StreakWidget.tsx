'use client'

import { useEffect, useState } from 'react'
import { getUserStreak } from '@/lib/api'
import { AlertCircle } from 'lucide-react'

interface StreakData {
  currentStreak: number
  longestStreak: number
  lastArticleReadDate: string | null
  badges: string[]
}

export function StreakWidget() {
  const [streak, setStreak] = useState<StreakData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStreak = async () => {
      try {
        const data = await getUserStreak()
        setStreak(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load streak')
      } finally {
        setLoading(false)
      }
    }

    fetchStreak()
  }, [])

  if (loading) {
    return (
      <div className="bg-muted p-4 rounded-lg animate-pulse">
        <div className="h-4 bg-muted-foreground/20 rounded w-24 mb-2"></div>
        <div className="h-6 bg-muted-foreground/20 rounded w-16"></div>
      </div>
    )
  }

  if (error || !streak) {
    return (
      <div className="bg-muted p-4 rounded-lg">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="w-4 h-4" />
          <span>Unable to load streak</span>
        </div>
      </div>
    )
  }

  const getBadgeEmoji = (badge: string) => {
    switch (badge) {
      case '7-day-streak':
        return '🔥'
      case '30-day-streak':
        return '🌟'
      case '7-day-best':
        return '🏆'
      case '30-day-best':
        return '👑'
      default:
        return '✨'
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
          <p className="text-sm text-muted-foreground mb-1">Current Streak</p>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold text-orange-600 dark:text-orange-400">
              {streak.currentStreak}
            </span>
            <span className="text-2xl">🔥</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">days</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
          <p className="text-sm text-muted-foreground mb-1">Longest Streak</p>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {streak.longestStreak}
            </span>
            <span className="text-2xl">🏆</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">days</p>
        </div>
      </div>

      {streak.badges.length > 0 && (
        <div className="bg-muted p-4 rounded-lg">
          <p className="text-sm text-muted-foreground mb-3">Achievements</p>
          <div className="flex flex-wrap gap-2">
            {streak.badges.map((badge) => (
              <div
                key={badge}
                className="bg-background px-3 py-1 rounded-full text-sm font-medium border border-border flex items-center gap-1"
              >
                <span>{getBadgeEmoji(badge)}</span>
                <span className="capitalize">{badge.replace('-', ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {streak.lastArticleReadDate && (
        <div className="text-xs text-muted-foreground text-center pt-2">
          Last read: {new Date(streak.lastArticleReadDate).toLocaleDateString()}
        </div>
      )}
    </div>
  )
}
