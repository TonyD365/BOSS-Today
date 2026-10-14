import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { Picture } from '@/components/site/Picture'
import { StoryCard } from '@/components/site/StoryCard'
import { getAuthor } from '@/lib/data'

export const revalidate = 600
export const generateStaticParams = () => []

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = await getAuthor((await params).slug)
  return result ? { title: result.author.name } : {}
}

export default async function AuthorPage({ params }: Props) {
  const result = await getAuthor((await params).slug)
  if (!result) notFound()
  const { author, articles } = result

  return (
    <div className="listing">
      <header className="listing__header listing__header--author">
        {author.photo && <Picture media={author.photo} sizes="96px" className="avatar" />}
        <div>
          <h1>{author.name}</h1>
          {author.title && <p className="kicker">{author.title}</p>}
          {author.bio && <p>{author.bio}</p>}
        </div>
      </header>
      {articles.length === 0 && <p className="listing__empty">No published stories yet.</p>}
      {articles.map((article) => (
        <StoryCard key={article.id} article={article} variant="row" showSection />
      ))}
    </div>
  )
}
