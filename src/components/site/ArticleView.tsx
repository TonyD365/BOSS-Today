import React from 'react'

import { articleAuthors, articleSection, asMedia, formatDate } from '@/lib/format'
import { readingMinutes } from '@/lib/text'
import type { Article, Tag } from '@/payload-types'

import { ArticleBody } from './ArticleBody'
import { Byline } from './Byline'
import { Picture } from './Picture'

/** Plain links, so sharing loads nothing from other sites until a reader clicks. */
function ShareLinks({ url, title }: { url: string; title: string }) {
  const u = encodeURIComponent(url)
  const t = encodeURIComponent(title)
  return (
    <div className="share" aria-label="Share this story">
      <button type="button" className="share__button" data-share-native hidden>
        Share
      </button>
      <button type="button" className="share__button" data-share-copy={url} hidden>
        Copy link
      </button>
      <a className="share__button" href={`mailto:?subject=${t}&body=${u}`}>
        Email
      </a>
      <a
        className="share__button"
        href={`https://x.com/intent/post?url=${u}&text=${t}`}
        target="_blank"
        rel="noreferrer"
      >
        X
      </a>
      <a
        className="share__button"
        href={`https://www.facebook.com/sharer/sharer.php?u=${u}`}
        target="_blank"
        rel="noreferrer"
      >
        Facebook
      </a>
    </div>
  )
}

/**
 * A full story as readers see it. Also used for the live preview while editing,
 * where there is no public address to share yet.
 */
export function ArticleView({ article, shareUrl }: { article: Article; shareUrl?: string }) {
  const section = articleSection(article)
  const authors = articleAuthors(article)
  const image = asMedia(article.heroImage)
  const tags = (article.tags ?? []).filter(
    (tag): tag is Tag => typeof tag === 'object' && tag !== null && Boolean(tag.slug),
  )
  const corrections = (article.corrections ?? []).filter((item) => item.text?.trim())
  const updated = corrections.reduce<string | null>(
    (latest, item) =>
      item.date && (!latest || new Date(item.date) > new Date(latest)) ? item.date : latest,
    null,
  )

  return (
    <article className="article">
      <header className="article__header">
        {section && (
          <a className="kicker" href={`/section/${section.slug}`}>
            {section.name}
          </a>
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
        {updated && (
          <span className="article__updated">
            Updated <time dateTime={updated}>{formatDate(updated)}</time>
          </span>
        )}
        <span className="article__reading">{readingMinutes(article.content)} min read</span>
      </div>
      {shareUrl && <ShareLinks url={shareUrl} title={article.title} />}

      <ArticleBody className="article__body" content={article.content} />

      {corrections.length > 0 && (
        <section className="article__corrections" aria-label="Corrections">
          {corrections.map((item, index) => (
            <p key={item.id ?? index}>
              <strong>Correction, {formatDate(item.date)}:</strong> {item.text}
            </p>
          ))}
        </section>
      )}

      {tags.length > 0 && (
        <nav className="article__tags" aria-label="Topics">
          <span>More on</span>
          <ul>
            {tags.map((tag) => (
              <li key={tag.id}>
                <a href={`/tags/${tag.slug}/`}>{tag.name}</a>
              </li>
            ))}
          </ul>
        </nav>
      )}

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
