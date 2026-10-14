import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { ArticleBody } from '@/components/site/ArticleBody'
import { Byline } from '@/components/site/Byline'
import { Picture } from '@/components/site/Picture'
import { getArticle } from '@/lib/data'
import { articleAuthors, articleSection, asMedia, formatDate } from '@/lib/format'

export const revalidate = 600
export const generateStaticParams = () => []

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await getArticle((await params).slug)
  if (!article) return {}
  const image = asMedia(article.heroImage)
  return {
    title: article.title,
    description: article.summary,
    openGraph: {
      type: 'article',
      title: article.title,
      description: article.summary,
      publishedTime: article.publishedAt ?? undefined,
      images: image?.url ? [image.sizes?.hero?.url ?? image.url] : undefined,
    },
  }
}

export default async function ArticlePage({ params }: Props) {
  const article = await getArticle((await params).slug)
  if (!article) notFound()

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
