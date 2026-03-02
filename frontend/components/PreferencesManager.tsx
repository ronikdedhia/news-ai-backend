'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getUserPreferences, updateUserPreferences, createUserPreferences, UserPreferences } from '@/lib/api'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

const CATEGORIES = ['education', 'entertainment', 'politics', 'sports', 'technology']
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

export function PreferencesManager() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [preferredLanguage, setPreferredLanguage] = useState('english')
  const [fontSize, setFontSize] = useState('medium')
  const [theme, setTheme] = useState('light')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [emailDigestFrequency, setEmailDigestFrequency] = useState('daily')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const prefs = await getUserPreferences()
        setPreferences(prefs)
        setSelectedCategories(prefs.preferredCategories)
        setPreferredLanguage(prefs.preferredLanguage)
        setFontSize(prefs.fontSize)
        setTheme(prefs.theme)
        setNotificationsEnabled(prefs.notificationsEnabled)
        setEmailDigestFrequency(prefs.emailDigestFrequency)
      } catch (err: any) {
        // If preferences don't exist, set defaults
        if (err.response?.status === 404 || err.message?.includes('not found')) {
          setSelectedCategories(['technology', 'entertainment', 'sports'])
          setPreferredLanguage('english')
          setFontSize('medium')
          setTheme('light')
          setNotificationsEnabled(true)
          setEmailDigestFrequency('daily')
        } else {
          setError(err.message || 'Failed to load preferences')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchPreferences()
  }, [])

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category)
      } else if (prev.length < 3) {
        return [...prev, category]
      }
      return prev
    })
    setHasChanges(true)
  }

  const handleFieldChange = (field: string, value: any) => {
    switch (field) {
      case 'language':
        setPreferredLanguage(value)
        break
      case 'fontSize':
        setFontSize(value)
        break
      case 'theme':
        setTheme(value)
        break
      case 'notifications':
        setNotificationsEnabled(value)
        break
      case 'emailDigest':
        setEmailDigestFrequency(value)
        break
    }
    setHasChanges(true)
  }

  const handleSave = async () => {
    setError(null)
    setSuccess(false)

    if (selectedCategories.length !== 3) {
      setError('Please select exactly 3 categories')
      return
    }

    setSaving(true)
    try {
      // If preferences don't exist yet, create them
      if (!preferences) {
        await createUserPreferences({
          preferredCategories: selectedCategories,
          preferredLanguage,
          fontSize,
          theme,
          notificationsEnabled,
          emailDigestFrequency,
        })
      } else {
        // Otherwise update existing preferences
        await updateUserPreferences({
          preferredCategories: selectedCategories,
          preferredLanguage,
          fontSize,
          theme,
          notificationsEnabled,
          emailDigestFrequency,
        })
      }

      // Apply changes immediately to UI
      const html = document.documentElement
      if (theme === 'dark') {
        html.classList.add('dark')
      } else {
        html.classList.remove('dark')
      }
      html.setAttribute('data-font-size', fontSize)

      setSuccess(true)
      setHasChanges(false)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
          <p className="text-gray-600 mt-2">Loading preferences...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>Manage your personalized news experience</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Categories */}
        <div>
          <label className="text-sm font-semibold mb-3 block">
            Your Top 3 Categories ({selectedCategories.length}/3)
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
            onChange={(e) => handleFieldChange('language', e.target.value)}
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
                onClick={() => handleFieldChange('fontSize', size)}
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
                onClick={() => handleFieldChange('theme', t)}
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
              onChange={(e) => handleFieldChange('notifications', e.target.checked)}
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
            onChange={(e) => handleFieldChange('emailDigest', e.target.value)}
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

        {/* Success Message */}
        {success && (
          <div className="flex gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm">Preferences saved successfully!</p>
          </div>
        )}

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saving || selectedCategories.length !== 3}
          className="w-full"
          size="lg"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </CardContent>
    </Card>
  )
}
