'use client'

import { useAuth } from '@clerk/nextjs'
import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from './ui/button'
import { CATEGORIES } from '@/lib/categories'

interface CategoryFilterProps {
  selectedCategory: string | null
  onCategoryChange: (category: string | null) => void
}

const CATEGORY_GRADIENTS: Record<string, string> = {
  technology:    'from-blue-500 to-cyan-500',
  business:      'from-emerald-500 to-teal-500',
  sports:        'from-orange-500 to-amber-500',
  entertainment: 'from-pink-500 to-rose-500',
  health:        'from-green-500 to-emerald-600',
  science:       'from-purple-500 to-violet-600',
  education:     'from-indigo-500 to-blue-600',
  politics:      'from-red-500 to-rose-600',
  world:         'from-sky-500 to-blue-500',
  nation:        'from-yellow-500 to-orange-500',
}

export function CategoryFilter({ selectedCategory, onCategoryChange }: CategoryFilterProps) {
  const { isSignedIn } = useAuth()
  const [showPaywall, setShowPaywall] = useState(false)

  const handleCategoryClick = (category: string) => {
    if (!isSignedIn) { setShowPaywall(true); return }
    onCategoryChange(category)
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => onCategoryChange(null)}
          className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
            selectedCategory === null
              ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30 scale-105'
              : 'glass text-muted-foreground hover:text-foreground hover:scale-105'
          }`}
        >
          All
        </button>

        {CATEGORIES.map((category) => {
          const grad = CATEGORY_GRADIENTS[category] ?? 'from-slate-500 to-slate-600'
          const isActive = selectedCategory === category
          return (
            <button
              key={category}
              onClick={() => handleCategoryClick(category)}
              className={`px-4 py-1.5 rounded-xl text-sm font-semibold capitalize transition-all duration-200 ${
                isActive
                  ? `bg-gradient-to-r ${grad} text-white shadow-lg scale-105`
                  : 'glass text-muted-foreground hover:text-foreground hover:scale-105'
              }`}
            >
              {category}
            </button>
          )
        })}

        <button
          onClick={() => handleCategoryClick('others')}
          className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
            selectedCategory === 'others'
              ? 'bg-gradient-to-r from-slate-500 to-slate-600 text-white shadow-lg scale-105'
              : 'glass text-muted-foreground hover:text-foreground hover:scale-105'
          }`}
        >
          Others
        </button>
      </div>

      {showPaywall && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-strong rounded-3xl shadow-2xl max-w-sm w-full p-8 relative animate-in fade-in zoom-in-95 duration-300">
            <button
              onClick={() => setShowPaywall(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-3xl shadow-lg shadow-indigo-500/30">
                🔒
              </div>
              <h2 className="text-xl font-bold mb-2">Sign in to filter</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Browse articles by category and get personalized recommendations.
              </p>
              <div className="space-y-3">
                <a href="/sign-in" className="block">
                  <Button className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 border-0 shadow-lg shadow-indigo-500/25">
                    Sign In
                  </Button>
                </a>
                <Button variant="outline" className="w-full glass border-white/30" onClick={() => setShowPaywall(false)}>
                  Continue as Guest
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
