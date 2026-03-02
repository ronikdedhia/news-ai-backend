'use client'

import { useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { getUserPreferences, createUserPreferences } from '@/lib/api'

export function PreferencesApplier() {
  const { user, isLoaded } = useUser()

  useEffect(() => {
    if (!isLoaded || !user) return

    const applyPreferences = async () => {
      try {
        const prefs = await getUserPreferences()
        const html = document.documentElement

        // Apply theme
        if (prefs.theme === 'dark') {
          html.classList.add('dark')
        } else {
          html.classList.remove('dark')
        }

        // Apply font size
        html.setAttribute('data-font-size', prefs.fontSize)
      } catch (error: any) {
        // If user doesn't have preferences, create default ones
        if (error.response?.status === 404 || error.message?.includes('not found')) {
          try {
            await createUserPreferences({
              preferredCategories: ['technology', 'entertainment', 'sports'],
              preferredLanguage: 'english',
              fontSize: 'medium',
              theme: 'light',
              notificationsEnabled: true,
              emailDigestFrequency: 'daily',
            })
            // Apply default preferences
            const html = document.documentElement
            html.classList.remove('dark')
            html.setAttribute('data-font-size', 'medium')
          } catch (createError) {
            console.error('Failed to create default preferences:', createError)
          }
        } else {
          console.error('Failed to apply preferences:', error)
        }
      }
    }

    applyPreferences()
  }, [user, isLoaded])

  return null
}

