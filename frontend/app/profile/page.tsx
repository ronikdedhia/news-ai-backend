'use client'

import { useUser } from '@clerk/nextjs'
import { useEffect, useState } from 'react'
import { useApiClient } from '@/lib/useApiClient'
import { getCurrentUser } from '@/lib/api'
import { AlertCircle } from 'lucide-react'

interface UserData {
  id: string
  email: string
  firstName?: string
  lastName?: string
  isPremium: number
  articlesViewedCount: number
  createdAt: string
}

export default function ProfilePage() {
  const { user: clerkUser, isLoaded } = useUser()
  useApiClient() // Initialize API client with token
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded) return

    if (!clerkUser) {
      setLoading(false)
      return
    }

    const fetchUserData = async () => {
      try {
        const data = await getCurrentUser()
        setUserData(data as UserData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [clerkUser, isLoaded])

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (!clerkUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Not Signed In</h2>
          <p className="text-muted-foreground">Please sign in to view your profile.</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card border border-border rounded-lg p-8">
        <div className="flex items-center gap-6 mb-8">
          {clerkUser.imageUrl && (
            <img
              src={clerkUser.imageUrl}
              alt={clerkUser.fullName || 'Profile'}
              className="w-24 h-24 rounded-full"
            />
          )}
          <div>
            <h1 className="text-3xl font-bold">{clerkUser.fullName || 'User'}</h1>
            <p className="text-muted-foreground">{clerkUser.primaryEmailAddress?.emailAddress}</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Email</p>
              <p className="font-semibold">{clerkUser.primaryEmailAddress?.emailAddress}</p>
            </div>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Member Since</p>
              <p className="font-semibold">
                {userData?.createdAt
                  ? new Date(userData.createdAt).toLocaleDateString()
                  : 'N/A'}
              </p>
            </div>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Articles Viewed</p>
              <p className="font-semibold">{userData?.articlesViewedCount || 0}</p>
            </div>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Access Level</p>
              <p className="font-semibold">✨ Unlimited Access</p>
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <h2 className="text-lg font-semibold mb-4">Account Information</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account Status</span>
                <span className="text-green-600 font-semibold">Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
