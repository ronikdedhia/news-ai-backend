'use client'

import { SignedIn, SignedOut, UserButton, useAuth } from '@clerk/nextjs'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { Bell, Zap } from 'lucide-react'
import { getUnreadNotificationCount } from '@/lib/api'

export function Header() {
  const [mounted, setMounted] = useState(false)
  const { isSignedIn } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const prevUnreadRef = useRef(0)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!isSignedIn) return

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    getUnreadNotificationCount().then(count => {
      setUnreadCount(count)
      prevUnreadRef.current = count
    })

    const interval = setInterval(async () => {
      const count = await getUnreadNotificationCount()
      if (count > prevUnreadRef.current && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        const diff = count - prevUnreadRef.current
        new Notification('Daily Bytes', {
          body: `${diff} new keyword alert match${diff > 1 ? 'es' : ''}`,
          icon: '/favicon.svg',
        })
      }
      prevUnreadRef.current = count
      setUnreadCount(count)
    }, 60_000)
    return () => clearInterval(interval)
  }, [isSignedIn])

  const navLinks = (
    <SignedIn>
      <Link
        href="/dashboard"
        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-white/50 dark:hover:bg-white/5"
      >
        Dashboard
      </Link>
      <Link
        href="/profile"
        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-white/50 dark:hover:bg-white/5"
      >
        Profile
      </Link>
      <Link
        href="/developer"
        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-white/50 dark:hover:bg-white/5"
      >
        API
      </Link>
      <Link
        href="/notifications"
        className="relative flex items-center justify-center w-9 h-9 rounded-xl hover:bg-white/50 dark:hover:bg-white/5 transition-colors"
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-gradient-to-br from-rose-500 to-pink-600 text-white rounded-full shadow-lg shadow-rose-500/30">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Link>
      <UserButton
        afterSignOutUrl="/"
        appearance={{ elements: { avatarBox: 'w-9 h-9' } }}
      />
    </SignedIn>
  )

  const skeleton = (
    <header className="sticky top-0 z-50 w-full glass-strong border-b border-white/30 dark:border-white/[0.06] shadow-sm shadow-black/[0.03]">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </header>
  )

  if (!mounted) return skeleton

  return (
    <header className="sticky top-0 z-50 w-full glass-strong border-b border-white/30 dark:border-white/[0.06] shadow-sm shadow-black/[0.03]">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <SignedOut>
              <Link
                href="/sign-in"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-white/50 dark:hover:bg-white/5"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="text-sm font-semibold px-4 py-1.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-indigo-500/25"
              >
                Sign Up
              </Link>
            </SignedOut>
            {navLinks}
          </div>
        </div>
      </div>
    </header>
  )
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity group">
      <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25 group-hover:shadow-indigo-500/40 transition-shadow">
        <Zap className="w-5 h-5 text-white" />
      </div>
      <div>
        <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent leading-none">
          Daily Bytes
        </h1>
        <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Stay informed, stay ahead</p>
      </div>
    </Link>
  )
}
