'use client'

import Image from 'next/image'
import { ExternalLink, Newspaper } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { truncateText } from '@/lib/utils'
import { Article } from '@/lib/api'

interface NewsCardProps {
  article: Article
}

export function NewsCard({ article }: NewsCardProps) {
  const hasImage = article.imageUrl && article.imageUrl.trim() !== ''

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300 h-full flex flex-col">
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
        {/* Source Badge */}
        <div className="flex items-center gap-2 mb-3">
          <Newspaper className="w-4 h-4 text-accent" />
          <span className="text-xs font-semibold text-accent uppercase tracking-wide">
            {article.sourceName}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold leading-tight mb-3 line-clamp-3 text-foreground">
          {article.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-4 line-clamp-3 flex-1">
          {truncateText(article.description || article.content, 150) || 'No description available'}
        </p>

        {/* Read More Button */}
        <Button
          asChild
          variant="default"
          className="w-full"
        >
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2"
          >
            Read Full Article
            <ExternalLink className="w-4 h-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}

