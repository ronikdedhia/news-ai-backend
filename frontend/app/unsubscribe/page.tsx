'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function UnsubscribePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isUnsubscribed, setIsUnsubscribed] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(true);

  const handleUnsubscribe = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Call public unsubscribe API
      const response = await fetch('/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setIsUnsubscribed(true);
        setShowEmailForm(false);
      } else {
        setError('Failed to unsubscribe. Please try again or contact support.');
      }
    } catch (err) {
      setError('An error occurred. Please try again later.');
      console.error('Unsubscribe error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isUnsubscribed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Unsubscribed</h1>
            <p className="text-gray-600">
              You have been successfully unsubscribed from our newsletter. You won&apos;t receive any more emails from us.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> You can resubscribe anytime by going to your preferences in your account settings.
            </p>
          </div>

          <Button
            onClick={() => router.push('/')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            Back to Home
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Unsubscribe from Newsletter</h1>
          <p className="text-gray-600">
            We&apos;re sorry to see you go. Enter your email to unsubscribe from our daily newsletter.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800">
            <strong>Before you go:</strong> You can manage your newsletter preferences instead of unsubscribing completely.
          </p>
        </div>

        {showEmailForm && (
          <div className="space-y-4 mb-6">
            <input
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />

            <div className="flex gap-3">
              <Button
                onClick={() => router.push('/')}
                variant="outline"
                className="flex-1"
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUnsubscribe}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={isLoading}
              >
                {isLoading ? 'Unsubscribing...' : 'Unsubscribe'}
              </Button>
            </div>
          </div>
        )}

        <button
          onClick={() => router.push('/newsletter-preferences')}
          className="w-full text-center text-sm text-blue-600 hover:text-blue-700 hover:underline py-2"
        >
          Manage preferences instead
        </button>
      </Card>
    </div>
  );
}
