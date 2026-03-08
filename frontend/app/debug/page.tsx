'use client'

import { useAuth, useUser } from '@clerk/nextjs'
import { useEffect, useState } from 'react'

export default function DebugPage() {
  const { isLoaded, isSignedIn, userId } = useAuth()
  const { user } = useUser()
  const [mounted, setMounted] = useState(false)
  const [sessionData, setSessionData] = useState<string>('Loading...')

  useEffect(() => {
    setMounted(true)
    
    // Simple cookie reader
    setTimeout(() => {
      try {
        const allCookies = document.cookie
        const hasSession = allCookies.includes('__session=')
        
        if (hasSession) {
          // Extract just the __session cookie
          const match = allCookies.match(/__session=([^;]+)/)
          if (match && match[1]) {
            const token = match[1]
            const parts = token.split('.')
            if (parts.length === 3) {
              try {
                const decoded = atob(parts[1])
                const payload = JSON.parse(decoded)
                setSessionData(`✓ FOUND - User: ${payload.sub}`)
              } catch (e) {
                setSessionData('✗ Cookie exists but can\'t decode')
              }
            }
          }
        } else {
          setSessionData('✗ No __session cookie found')
        }
      } catch (err) {
        setSessionData(`✗ Error: ${err}`)
      }
    }, 100)
  }, [])

  return (
    <div className="min-h-screen p-8 bg-slate-900 text-white">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Clerk Debug</h1>

        <div className="bg-red-900 p-4 rounded">
          <h2 className="text-xl font-bold mb-2">useAuth() Hook Says:</h2>
          <p className="text-2xl">{isSignedIn ? '✓ SIGNED IN' : '✗ NOT SIGNED IN'}</p>
          <p>User ID: {userId || 'none'}</p>
          <p>Email: {user?.emailAddresses[0]?.emailAddress || 'none'}</p>
        </div>

        <div className="bg-green-900 p-4 rounded">
          <h2 className="text-xl font-bold mb-2">Cookie Check:</h2>
          <p className="text-2xl">{sessionData}</p>
        </div>

        <div className="bg-yellow-900 p-4 rounded">
          <h2 className="text-xl font-bold mb-2">Summary</h2>
          {isSignedIn ? (
            <p className="text-green-300">✓ Clerk hooks are working</p>
          ) : (
            <>
              <p className="text-red-300">✗ Clerk hooks say you're not signed in</p>
              <p className="text-sm mt-2">But if the cookie check shows ✓ FOUND, then the session exists but Clerk's hooks aren't reading it.</p>
              <p className="text-sm">This is a Clerk bug that requires a workaround.</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
