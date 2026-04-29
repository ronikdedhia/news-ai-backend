export const ALLOWED_CATEGORIES = [
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

// Normalise any incoming category string to the allowed list.
// Returns null if the value is not in the list (e.g. "top", "trending", unknown).
export function normalizeCategory(raw: string | null | undefined): string | null {
  if (!raw) return null
  const lower = raw.toLowerCase().trim()
  return (ALLOWED_CATEGORIES as readonly string[]).includes(lower) ? lower : null
}
