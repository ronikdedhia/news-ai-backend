export const CATEGORIES = [
  'technology',
  'business',
  'sports',
  'entertainment',
  'health',
  'science',
  'education',
  'politics',
  'world',
  'nation',
] as const

export type Category = typeof CATEGORIES[number]

export const CATEGORY_COLORS: Record<string, string> = {
  technology:    'bg-blue-100 text-blue-800',
  business:      'bg-green-100 text-green-800',
  sports:        'bg-red-100 text-red-800',
  entertainment: 'bg-purple-100 text-purple-800',
  health:        'bg-pink-100 text-pink-800',
  science:       'bg-cyan-100 text-cyan-800',
  education:     'bg-yellow-100 text-yellow-800',
  politics:      'bg-orange-100 text-orange-800',
  world:         'bg-indigo-100 text-indigo-800',
  nation:        'bg-amber-100 text-amber-800',
}
