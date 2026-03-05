'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type EmailDigestFrequency = 'daily' | 'weekly' | 'never';

export default function NewsletterPreferencesPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [preferences, setPreferences] = useState({
    notificationsEnabled: true,
    emailDigestFrequency: 'daily' as EmailDigestFrequency,
  });

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await fetch('/api/auth/preferences');
      if (response.ok) {
        const data = await response.json();
        setPreferences({
          notificationsEnabled: data.preferences.notificationsEnabled,
          emailDigestFrequency: data.preferences.emailDigestFrequency || 'daily',
        });
      } else if (response.status === 401) {
        router.push('/sign-in');
      }
    } catch (err) {
      console.error('Error fetching preferences:', err);
      setError('Failed to load preferences');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/auth/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notificationsEnabled: preferences.notificationsEnabled,
          emailDigestFrequency: preferences.emailDigestFrequency,
        }),
      });

      if (response.ok) {
        setSuccess('Preferences saved successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Failed to save preferences. Please try again.');
      }
    } catch (err) {
      console.error('Error saving preferences:', err);
      setError('An error occurred. Please try again later.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading preferences...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Newsletter Preferences</h1>
          <p className="text-gray-600">
            Manage how you receive our daily newsletter
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Newsletter Toggle */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Newsletter Emails</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Receive our daily news digest
                </p>
              </div>
              <button
                onClick={() =>
                  setPreferences({
                    ...preferences,
                    notificationsEnabled: !preferences.notificationsEnabled,
                  })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.notificationsEnabled
                    ? 'bg-blue-600'
                    : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.notificationsEnabled
                      ? 'translate-x-6'
                      : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Frequency Selection */}
          {preferences.notificationsEnabled && (
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Email Frequency</h3>
              <div className="space-y-2">
                {[
                  { value: 'daily' as EmailDigestFrequency, label: 'Daily', description: 'Every morning at 8:00 AM' },
                  { value: 'weekly' as EmailDigestFrequency, label: 'Weekly', description: 'Every Monday at 8:00 AM' },
                  { value: 'never' as EmailDigestFrequency, label: 'Never', description: 'Don\'t send me emails' },
                ].map((option) => (
                  <label key={option.value} className="flex items-center p-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="frequency"
                      value={option.value}
                      checked={preferences.emailDigestFrequency === option.value}
                      onChange={(e) =>
                        setPreferences({
                          ...preferences,
                          emailDigestFrequency: e.target.value as EmailDigestFrequency,
                        })
                      }
                      className="w-4 h-4 text-blue-600"
                    />
                    <div className="ml-3">
                      <p className="font-medium text-gray-900">{option.label}</p>
                      <p className="text-sm text-gray-600">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Changes may take up to 24 hours to take effect.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={() => router.push('/')}
              variant="outline"
              className="flex-1"
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>

          {/* Unsubscribe Link */}
          <button
            onClick={() => router.push('/unsubscribe')}
            className="w-full text-center text-sm text-red-600 hover:text-red-700 hover:underline py-2"
          >
            Unsubscribe from all emails
          </button>
        </div>
      </Card>
    </div>
  );
}
