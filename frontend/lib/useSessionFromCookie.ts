'use client'

import { useEffect, useState } from 'react'

interface SessionData {
  sub: string
  email?: string
  isSignedIn: boolean
}

export function useSessionFromCookie(): SessionData & { isLoaded: boolean } {
  const [session, setSession] = useState<SessionData>({
    sub: '',
    email: undefined,
    isSignedIn: false,
  })
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // Read the __session cookie and decode it
    const cookies = document.cookie.split(';')
    const sessionCookie = cookies.find(c => c.trim().startsWith('__session='))

    if (sessionCookie) {
      try {
        const token = sessionCookie.split('=')[1]
        if (token) {
          // Decode JWT (without verification - just for reading)
          const parts = token.split('.')
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]))
            setSession({
              sub: payload.sub,
              email: payload.email,
              isSignedIn: true,
            })
          }
        }
      } catch (err) {
        console.error('Error decoding session:', err)
      }
    }

    setIsLoaded(true)
  }, [])

  return { ...session, isLoaded }
}
