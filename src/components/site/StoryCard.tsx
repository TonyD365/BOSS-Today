import React from 'react'

import { articleAuthors, articleSection, asMedia, formatDate } from '@/lib/format'
import type { Article } from '@/payload-types'

import { Byline } from './Byline'
import { Picture } from './Picture'

type Props = {
  article: Article
  variant?: 'lead' | 'standard' | 'compact' | 'row'
  showSection?: boolean
  showImage?: boolean
}

export function StoryCard({
  article,
  variant = 'standard',
  showSection = false,
  showImage = true,
}: Props) {
  const href = `/article/${article.slug}`
  const section = articleSection(article)
  const image = showImage && variant !== 'compact' ? asMedia(article.heroImage) : undefined
  const Heading = variant === 'lead' ? 'h2' : 'h3'

  return (
    <article className={`story story--${variant}`}>
      <div className="story__text">
        {showSection && section && (
          <a className="kicker" href={`/section/${section.slug}`}>
            {section.name}
          </a>
        )}
        <Heading className="story__headline">
          <a href={href}>{article.title}</a>
        </Heading>
        {variant !== 'compact' && <p className="story__summary">{article.summary}</p>}
        <p className="story__meta">
          <Byline authors={articleAuthors(article)} linked={false} />
          {variant === 'row' && <time>{formatDate(article.publishedAt)}</time>}
        </p>
      </div>
      {image && (
        <a className="story__image" href={href} tabIndex={-1} aria-hidden="true">
          <Picture
            media={image}
            priority={variant === 'lead'}
            sizes={
              variant === 'lead'
                ? '(min-width: 900px) 520px, 100vw'
                : '(min-width: 900px) 280px, 100vw'
            }
          />
        </a>
      )}
    </article>
  )
}
