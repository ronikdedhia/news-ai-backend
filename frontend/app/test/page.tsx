'use client'

import { useAuth, useUser } from '@clerk/nextjs'

export default function TestPage() {
  const { isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Clerk Test</h1>
        <div className="space-y-2 text-lg">
          <p>Loaded: {isLoaded ? '✓' : '✗'}</p>
          <p>Signed In: {isSignedIn ? '✓' : '✗'}</p>
          <p>Email: {user?.emailAddresses[0]?.emailAddress || 'none'}</p>
        </div>
      </div>
    </div>
  )
}
