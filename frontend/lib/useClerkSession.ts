'use client'

import { useEffect, useState } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'

export function useClerkSession() {
  const auth = useAuth()
  const user = useUser()
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Wait for Clerk to fully load
    if (auth.isLoaded) {
      setIsReady(true)
    }
  }, [auth.isLoaded])

  return {
    ...auth,
    ...user,
    isReady,
  }
}
