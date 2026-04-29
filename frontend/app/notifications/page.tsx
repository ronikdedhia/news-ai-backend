'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Bell, BellOff, ExternalLink, Trash2, CheckCheck, Lock, Tag } from 'lucide-react'
import Link from 'next/link'
import { AppNotification, getNotifications, markAllNotificationsRead, markNotificationRead, deleteNotification } from '@/lib/api'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function NotificationsPage() {
  const { isSignedIn, isLoaded } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  const unreadCount = notifications.filter(n => n.read === 0).length

  const load = async () => {
    setLoading(true)
    try {
      const data = await getNotifications()
      setNotifications(data)
    } catch (e) {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isSignedIn) load()
    else if (isLoaded) setLoading(false)
  }, [isSignedIn, isLoaded])

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead()
    setNotifications(prev => prev.map(n => ({ ...n, read: 1 })))
  }

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: 1 } : n))
  }

  const handleDelete = async (id: string) => {
    await deleteNotification(id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const handleOpen = (n: AppNotification) => {
    if (n.read === 0) handleMarkRead(n.id)
  }

  if (isLoaded && !isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-sm">
          <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Sign in to view notifications</h2>
          <Link href="/sign-in" className="inline-block px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-muted-foreground">{unreadCount} unread</p>
            )}
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-input rounded-lg hover:bg-muted transition-colors"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16">
          <BellOff className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium mb-1">No notifications yet</p>
          <p className="text-sm text-muted-foreground">
            Set up keyword alerts in your{' '}
            <Link href="/profile" className="text-primary hover:underline">Profile</Link>{' '}
            to get notified when matching articles arrive.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div
              key={n.id}
              className={`relative flex items-start gap-3 p-4 rounded-xl border transition-colors ${
                n.read === 0
                  ? 'bg-primary/5 border-primary/20'
                  : 'bg-background border-border'
              }`}
            >
              {n.read === 0 && (
                <span className="absolute top-4 left-2 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              )}
              <div className="flex-1 min-w-0 pl-2">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                    <Tag className="w-2.5 h-2.5" />
                    {n.keyword}
                  </span>
                  <span className="text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
                </div>
                <p className={`text-sm leading-snug mb-2 ${n.read === 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                  {n.articleTitle}
                </p>
                <a
                  href={n.articleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleOpen(n)}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Read article
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {n.read === 0 && (
                  <button
                    onClick={() => handleMarkRead(n.id)}
                    className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    title="Mark as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(n.id)}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-red-500"
                  title="Dismiss"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
