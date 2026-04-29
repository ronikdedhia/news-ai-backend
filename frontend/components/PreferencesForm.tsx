'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createUserPreferences } from '@/lib/api'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

import { CATEGORIES } from '@/lib/categories'

const LANGUAGES = [
  { value: 'english', label: 'English' },
  { value: 'hindi', label: 'हिंदी (Hindi)' },
  { value: 'marathi', label: 'मराठी (Marathi)' },
  { value: 'gujarati', label: 'ગુજરાતી (Gujarati)' },
  { value: 'tamil', label: 'தமிழ் (Tamil)' },
  { value: 'spanish', label: 'Español (Spanish)' },
  { value: 'french', label: 'Français (French)' },
  { value: 'german', label: 'Deutsch (German)' },
]

interface PreferencesFormProps {
  onComplete?: () => void
}

export function PreferencesForm({ onComplete }: PreferencesFormProps) {
  const router = useRouter()
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [preferredLanguage, setPreferredLanguage] = useState('english')
  const [fontSize, setFontSize] = useState('medium')
  const [theme, setTheme] = useState('light')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [emailDigestFrequency, setEmailDigestFrequency] = useState('daily')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category)
      } else if (prev.length < 3) {
        return [...prev, category]
      }
      return prev
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (selectedCategories.length !== 3) {
      setError('Please select exactly 3 categories')
      return
    }

    setLoading(true)
    try {
      await createUserPreferences({
        preferredCategories: selectedCategories,
        preferredLanguage,
        fontSize,
        theme,
        notificationsEnabled,
        emailDigestFrequency,
      })

      // Apply theme and font-size immediately
      const html = document.documentElement
      if (theme === 'dark') {
        html.classList.add('dark')
      } else {
        html.classList.remove('dark')
      }
      html.setAttribute('data-font-size', fontSize)

      setSuccess(true)
      setTimeout(() => {
        onComplete?.()
        router.push('/')
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Failed to save preferences')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <Card className="w-full max-w-2xl">
        <CardContent className="pt-6 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Preferences Saved!</h2>
          <p className="text-muted-foreground">Redirecting to home...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Personalize Your Experience</CardTitle>
        <CardDescription>
          Choose your preferences to get the best news experience tailored for you
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Categories */}
          <div>
            <label className="text-sm font-semibold mb-3 block">
              Select Your Top 3 Categories ({selectedCategories.length}/3)
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {CATEGORIES.map(category => (
                <button
                  key={category}
                  type="button"
                  onClick={() => handleCategoryToggle(category)}
                  className={`p-3 rounded-lg border-2 transition-all capitalize font-medium ${
                    selectedCategories.includes(category)
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div>
            <label className="text-sm font-semibold mb-2 block">Preferred Language</label>
            <select
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 dark:bg-slate-900 dark:border-slate-700 dark:text-white dark:focus:ring-blue-400"
            >
              {LANGUAGES.map(lang => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* Font Size */}
          <div>
            <label className="text-sm font-semibold mb-2 block">Font Size</label>
            <div className="flex gap-3">
              {['small', 'medium', 'large'].map(size => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setFontSize(size)}
                  className={`flex-1 p-2 rounded-lg border-2 transition-all capitalize font-medium ${
                    fontSize === size
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div>
            <label className="text-sm font-semibold mb-2 block">Theme</label>
            <div className="flex gap-3">
              {['light', 'dark'].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={`flex-1 p-2 rounded-lg border-2 transition-all capitalize font-medium ${
                    theme === t
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div>
            <label className="text-sm font-semibold mb-2 block">Notifications</label>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="notifications"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <label htmlFor="notifications" className="text-sm text-gray-700">
                Enable notifications
              </label>
            </div>
          </div>

          {/* Email Digest */}
          <div>
            <label className="text-sm font-semibold mb-2 block">Email Digest Frequency</label>
            <select
              value={emailDigestFrequency}
              onChange={(e) => setEmailDigestFrequency(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 dark:bg-slate-900 dark:border-slate-700 dark:text-white dark:focus:ring-blue-400"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="never">Never</option>
            </select>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading || selectedCategories.length !== 3}
            className="w-full"
            size="lg"
          >
            {loading ? 'Saving...' : 'Complete Setup'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
