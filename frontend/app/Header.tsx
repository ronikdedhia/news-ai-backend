'use client'

import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { useState, useEffect } from 'react'

export function Header() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="text-2xl">📰</div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">News Daily</h1>
                <p className="text-xs text-muted-foreground">Stay informed, stay ahead</p>
              </div>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/sign-in" className="text-sm font-medium hover:text-primary transition-colors">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="text-2xl">📰</div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">News Daily</h1>
              <p className="text-xs text-muted-foreground">Stay informed, stay ahead</p>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <SignedOut>
              <Link href="/sign-in" className="text-sm font-medium hover:text-primary transition-colors px-4 py-2 rounded-md hover:bg-muted">
                Sign In
              </Link>
              <Link href="/sign-up" className="text-sm font-medium px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                Sign Up
              </Link>
            </SignedOut>

            <SignedIn>
              <Link href="/profile" className="text-sm font-medium hover:text-primary transition-colors px-4 py-2 rounded-md hover:bg-muted">
                Profile
              </Link>
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: 'w-10 h-10',
                  },
                }}
              />
            </SignedIn>
          </div>
        </div>
      </div>
    </header>
  )
}
