'use client'

import { useAuth } from '@clerk/nextjs'
import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from './ui/button'

const CATEGORIES = [
  'technology',
  'business',
  'health',
  'science',
  'sports',
  'entertainment',
  'politics',
  'world',
  'others',
]

interface CategoryFilterProps {
  selectedCategory: string | null
  onCategoryChange: (category: string | null) => void
}

export function CategoryFilter({ selectedCategory, onCategoryChange }: CategoryFilterProps) {
  const { isSignedIn } = useAuth()
  const [showPaywall, setShowPaywall] = useState(false)

  const handleCategoryClick = (category: string) => {
    if (!isSignedIn) {
      setShowPaywall(true)
      return
    }
    onCategoryChange(category)
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => onCategoryChange(null)}
          className={`px-4 py-2 rounded-full font-medium transition-all duration-300 ${
            selectedCategory === null
              ? 'bg-primary text-primary-foreground shadow-lg scale-105'
              : 'bg-muted hover:bg-muted/80 text-foreground'
          }`}
        >
          All News
        </button>
        {CATEGORIES.map((category) => (
          <button
            key={category}
            onClick={() => handleCategoryClick(category)}
            className={`px-4 py-2 rounded-full font-medium transition-all duration-300 capitalize ${
              selectedCategory === category
                ? 'bg-primary text-primary-foreground shadow-lg scale-105'
                : 'bg-muted hover:bg-muted/80 text-foreground'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Paywall Modal */}
      {showPaywall && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full p-8 relative animate-in fade-in zoom-in-95 duration-300">
            <button
              onClick={() => setShowPaywall(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center">
              <div className="text-5xl mb-4">🔒</div>
              <h2 className="text-2xl font-bold mb-2">Premium Feature</h2>
              <p className="text-muted-foreground mb-6">
                Browse articles by category and get personalized news recommendations. Sign in to unlock this feature.
              </p>

              <div className="space-y-3">
                <a href="/sign-in" className="block">
                  <Button className="w-full">Sign In</Button>
                </a>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowPaywall(false)}
                >
                  Continue as Guest
                </Button>
              </div>

              <p className="text-xs text-muted-foreground mt-4">
                Free users can browse all articles. Sign in for category filtering.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
