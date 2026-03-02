import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { getUserPreferences, updateUserPreferences, UserPreferences } from './api'

export function usePreferences() {
  const { user, isLoaded } = useUser()
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch preferences on mount and when user changes
  useEffect(() => {
    if (!isLoaded) return

    if (!user) {
      setLoading(false)
      return
    }

    const fetchPreferences = async () => {
      try {
        const prefs = await getUserPreferences()
        setPreferences(prefs)
        applyPreferences(prefs)
      } catch (error) {
        console.error('Failed to fetch preferences:', error)
        setLoading(false)
      }
    }

    fetchPreferences()
  }, [user, isLoaded])

  // Apply preferences to DOM
  const applyPreferences = (prefs: UserPreferences) => {
    const html = document.documentElement

    // Apply theme
    if (prefs.theme === 'dark') {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }

    // Apply font size
    html.setAttribute('data-font-size', prefs.fontSize)

    setLoading(false)
  }

  // Update preferences and apply immediately
  const updatePreferences = async (updates: Partial<UserPreferences>) => {
    try {
      const updated = await updateUserPreferences(updates)
      setPreferences(updated)
      applyPreferences(updated)
      return updated
    } catch (error) {
      console.error('Failed to update preferences:', error)
      throw error
    }
  }

  return {
    preferences,
    loading,
    updatePreferences,
  }
}
