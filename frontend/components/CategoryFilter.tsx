'use client'

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
  return (
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
          onClick={() => onCategoryChange(category)}
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
  )
}
