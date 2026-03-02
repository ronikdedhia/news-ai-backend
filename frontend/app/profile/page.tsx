'use client'

import { useUser } from '@clerk/nextjs'
import { useEffect, useState } from 'react'
import { useApiClient } from '@/lib/useApiClient'
import { getCurrentUser, getUserBookmarks, Article } from '@/lib/api'
import { NewsCard } from '@/components/NewsCard'
import { PreferencesManager } from '@/components/PreferencesManager'
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
  const [bookmarks, setBookmarks] = useState<Article[]>([])
  const [bookmarkCount, setBookmarkCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [bookmarksLoading, setBookmarksLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [activeTab, setActiveTab] = useState<'preferences' | 'bookmarks'>('preferences')

  useEffect(() => {
    if (!isLoaded) return

    if (!clerkUser) {
      setLoading(false)
      return
    }

    const fetchUserData = async () => {
      try {
        const data = await getCurrentUser()
        setUserData({
          id: data.id,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          isPremium: data.isPremium ? 1 : 0,
          articlesViewedCount: data.articlesViewedCount,
          createdAt: data.createdAt || new Date().toISOString(),
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [clerkUser, isLoaded])

  const loadBookmarks = async () => {
    if (bookmarksLoading) return
    
    setBookmarksLoading(true)
    try {
      const data = await getUserBookmarks(20, 0)
      setBookmarks(data.bookmarks)
      setBookmarkCount(data.count)
    } catch (err) {
      console.error('Error loading bookmarks:', err)
    } finally {
      setBookmarksLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'bookmarks' && bookmarks.length === 0) {
      loadBookmarks()
    }
  }, [activeTab])

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
    <div className="max-w-4xl mx-auto">
      <div className="bg-card border border-border rounded-lg p-8 mb-8">
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
            <div className="bg-muted p-4 rounded-lg cursor-pointer hover:bg-muted/80 transition-colors" onClick={loadBookmarks}>
              <p className="text-sm text-muted-foreground mb-1">Bookmarked Articles</p>
              <p className="font-semibold">{bookmarkCount}</p>
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

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-border">
        <button
          onClick={() => setActiveTab('preferences')}
          className={`px-4 py-2 font-semibold transition-colors ${
            activeTab === 'preferences'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Preferences
        </button>
        <button
          onClick={() => setActiveTab('bookmarks')}
          className={`px-4 py-2 font-semibold transition-colors ${
            activeTab === 'bookmarks'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Bookmarks ({bookmarkCount})
        </button>
      </div>

      {/* Preferences Tab */}
      {activeTab === 'preferences' && (
        <PreferencesManager />
      )}

      {/* Bookmarks Tab */}
      {activeTab === 'bookmarks' && (
        <div className="bg-card border border-border rounded-lg p-8">
          {bookmarksLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                <p className="text-muted-foreground">Loading bookmarks...</p>
              </div>
            </div>
          ) : bookmarks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No bookmarked articles yet. Start bookmarking articles from the news feed!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {bookmarks.map((article) => (
                <NewsCard 
                  key={article.id} 
                  article={{ ...article, isBookmarked: true }}
                  onBookmarkChange={() => {
                    // Refresh bookmarks when one is removed
                    loadBookmarks()
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
