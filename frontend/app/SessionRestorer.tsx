'use client'

import { useEffect, useState } from 'react'
import { useClerk } from '@clerk/nextjs'

/**
 * This component forces Clerk to properly restore the session from cookies.
 * It's a workaround for a Clerk hydration bug where useAuth() doesn't read
 * the session cookie on initial load.
 */
export function SessionRestorer() {
  const clerk = useClerk()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || !clerk) return

    // Force Clerk to load the session from cookies
    // This is a workaround for Clerk not properly hydrating the session
    const checkSession = async () => {
      try {
        // Trigger a session check
        await clerk.client?.sessions?.getActive()
      } catch (err) {
        // Silently fail - this is just a workaround
      }
    }

    checkSession()
  }, [mounted, clerk])

  return null
}
