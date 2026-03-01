import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string | Date | number | null | undefined): string {
  if (!dateString) {
    return 'Unknown date'
  }

  let date: Date
  
  if (typeof dateString === 'number') {
    // If it's a number, treat it as milliseconds
    date = new Date(dateString)
  } else if (typeof dateString === 'string') {
    // If it's a string, parse it
    date = new Date(dateString)
  } else {
    // If it's already a Date object
    date = dateString
  }
  
  // Check if date is valid
  if (!date || isNaN(date.getTime())) {
    return 'Unknown date'
  }
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function truncateText(text: string | null | undefined, maxLength: number): string {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}
