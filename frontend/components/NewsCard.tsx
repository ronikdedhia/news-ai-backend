'use client'

import { useRef, useState, useEffect } from 'react'
import Image from 'next/image'
import { useAuth } from '@clerk/nextjs'
import { ExternalLink, Newspaper, Volume2, Square, Bookmark, Share2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { truncateText } from '@/lib/utils'
import { Article, addBookmark, removeBookmark } from '@/lib/api'
import { ShareableImage } from '@/components/ShareableImage'

const getCategoryColor = (category: string): string => {
  const colors: Record<string, string> = {
    technology: 'bg-blue-100 text-blue-800',
    business: 'bg-green-100 text-green-800',
    sports: 'bg-red-100 text-red-800',
    entertainment: 'bg-purple-100 text-purple-800',
    health: 'bg-pink-100 text-pink-800',
    science: 'bg-cyan-100 text-cyan-800',
    education: 'bg-yellow-100 text-yellow-800',
    politics: 'bg-orange-100 text-orange-800',
    world: 'bg-indigo-100 text-indigo-800',
    nation: 'bg-amber-100 text-amber-800',
    lifestyle: 'bg-rose-100 text-rose-800',
    opinion: 'bg-violet-100 text-violet-800',
  }
  return colors[category.toLowerCase()] || 'bg-gray-100 text-gray-800'
}

interface NewsCardProps {
  article: Article & { isBookmarked?: boolean }
  onBookmarkChange?: (isBookmarked: boolean) => void
}

export function NewsCard({ article, onBookmarkChange }: NewsCardProps) {
  const { isSignedIn } = useAuth()
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(article.isBookmarked || false)
  const [isLoadingBookmark, setIsLoadingBookmark] = useState(false)
  const hasImage = article.imageUrl && article.imageUrl.trim() !== ''

  useEffect(() => {
    setIsBookmarked(article.isBookmarked || false)
  }, [article.isBookmarked])

  const handleTextToSpeech = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }

    const textToSpeak = `${article.title}. ${article.content || ''}`
    const utterance = new SpeechSynthesisUtterance(textToSpeak)
    utterance.rate = 1
    utterance.pitch = 1
    utterance.volume = 1

    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    setIsSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  const handleBookmarkClick = async () => {
    if (!isSignedIn) {
      window.location.href = '/sign-in'
      return
    }

    setIsLoadingBookmark(true)
    try {
      if (isBookmarked) {
        await removeBookmark(article.id)
        setIsBookmarked(false)
      } else {
        await addBookmark(article.id)
        setIsBookmarked(true)
      }
      onBookmarkChange?.(!isBookmarked)
    } catch (error) {
      console.error('Error toggling bookmark:', error)
    } finally {
      setIsLoadingBookmark(false)
    }
  }

  return (
    <Card className="overflow-hidden hover:shadow-2xl transition-shadow duration-300 h-full flex flex-col">
      {/* Image Section */}
      <div className="relative w-full h-48 bg-gradient-to-br from-slate-200 to-slate-300 overflow-hidden flex items-center justify-center">
        {hasImage ? (
          <Image
            src={article.imageUrl}
            alt={article.title}
            fill
            className="object-cover hover:scale-105 transition-transform duration-300"
            priority={false}
          />
        ) : (
          <div className="text-center px-4">
            <Newspaper className="w-12 h-12 text-slate-500 mx-auto mb-2" />
            <p className="text-sm text-slate-600 font-medium line-clamp-2">{article.title}</p>
          </div>
        )}
      </div>

      <CardContent className="flex-1 flex flex-col p-4">
        {/* Source Badge and Category */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Newspaper className="w-4 h-4 text-accent" />
          {article.category && (
            <span className={`text-xs font-semibold px-2 py-1 rounded-full uppercase tracking-wide ${getCategoryColor(article.category)}`}>
              {article.category}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold leading-tight mb-3 line-clamp-3 text-foreground">
          {article.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-4 flex-1 whitespace-pre-wrap">
          {article.content || 'No content available'}
        </p>

        {/* Hashtags */}
        {article.hashtags && (
          <div className="mb-4 flex flex-wrap gap-2">
            {article.hashtags.split(/\s+/).filter(tag => tag.startsWith('#')).map((tag, idx) => (
              <span key={idx} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium hover:bg-blue-100 transition-colors cursor-pointer">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 w-full">
          <Button
            onClick={handleTextToSpeech}
            variant={isSpeaking ? "destructive" : "outline"}
            size="sm"
            className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs whitespace-nowrap"
          >
            {isSpeaking ? (
              <>
                <Square className="w-3 h-3 flex-shrink-0" />
                <span>Stop</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3 h-3 flex-shrink-0" />
                <span>Listen</span>
              </>
            )}
          </Button>
          <Button
            onClick={handleBookmarkClick}
            disabled={isLoadingBookmark}
            variant={isBookmarked ? "default" : "outline"}
            size="sm"
            className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs whitespace-nowrap"
          >
            <Bookmark className={`w-3 h-3 flex-shrink-0 ${isBookmarked ? 'fill-current' : ''}`} />
            <span>{isBookmarked ? 'Saved' : 'Save'}</span>
          </Button>
          <ShareableImage
            title={article.title}
            description={article.content || ''}
            imageUrl={article.imageUrl || ''}
            category={article.category || 'News'}
          />
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors whitespace-nowrap"
          >
            <span>Read</span>
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
          </a>
        </div>
      </CardContent>
    </Card>
  )
}

