import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { StoryCard } from '@/components/site/StoryCard'
import { getSection } from '@/lib/data'

export const revalidate = 600
export const generateStaticParams = () => []

type Props = { params: Promise<{ slug: string; page?: string[] }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = await getSection((await params).slug)
  return result
    ? { title: result.section.name, description: result.section.description ?? undefined }
    : {}
}

export default async function SectionPage({ params }: Props) {
  const { slug, page: pageParam } = await params
  const page = Number(pageParam?.[0] ?? 1)
  if (!Number.isInteger(page) || page < 1 || (pageParam?.length ?? 0) > 1) notFound()
  const result = await getSection(slug, page)
  if (!result) notFound()
  const { section, articles } = result

  return (
    <div className="listing">
      <header className="listing__header">
        <h1>{section.name}</h1>
        {section.description && <p>{section.description}</p>}
      </header>
      {articles.docs.length === 0 && <p className="listing__empty">No stories here yet.</p>}
      {articles.docs.map((article) => (
        <StoryCard key={article.id} article={article as never} variant="row" />
      ))}
      <nav className="pager" aria-label="Pages">
        {articles.hasPrevPage && (
          <Link href={page === 2 ? `/section/${slug}` : `/section/${slug}/${page - 1}`}>
            ← Newer stories
          </Link>
        )}
        {articles.hasNextPage && <Link href={`/section/${slug}/${page + 1}`}>Older stories →</Link>}
      </nav>
    </div>
  )
}
