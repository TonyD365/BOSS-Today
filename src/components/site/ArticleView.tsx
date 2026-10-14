import Link from 'next/link'
import React from 'react'

import { articleAuthors, articleSection, asMedia, formatDate } from '@/lib/format'
import type { Article } from '@/payload-types'

import { ArticleBody } from './ArticleBody'
import { Byline } from './Byline'
import { Picture } from './Picture'

/** A full story as readers see it. Also used for the live preview while editing. */
export function ArticleView({ article }: { article: Article }) {
  const section = articleSection(article)
  const authors = articleAuthors(article)
  const image = asMedia(article.heroImage)

  return (
    <article className="article">
      <header className="article__header">
        {section && (
          <Link className="kicker" href={`/section/${section.slug}`}>
            {section.name}
          </Link>
        )}
        <h1>{article.title}</h1>
        <p className="article__summary">{article.summary}</p>
      </header>

      {image && (
        <figure className="article__figure">
          <Picture media={image} sizes="(min-width: 900px) 860px, 100vw" priority />
          {(image.caption || image.credit) && (
            <figcaption>
              {image.caption} {image.credit && <span className="credit">{image.credit}</span>}
            </figcaption>
          )}
        </figure>
      )}

      <div className="article__meta">
        <Byline authors={authors} />
        <time dateTime={article.publishedAt ?? undefined}>{formatDate(article.publishedAt)}</time>
      </div>

      <ArticleBody className="article__body" content={article.content} />

      {authors.some((author) => author.bio) && (
        <footer className="article__authors">
          {authors
            .filter((author) => author.bio)
            .map((author) => (
              <p key={author.id}>
                <strong>{author.name}</strong>
                {author.title ? `, ${author.title}. ` : '. '}
                {author.bio}
              </p>
            ))}
        </footer>
      )}
    </article>
  )
}
