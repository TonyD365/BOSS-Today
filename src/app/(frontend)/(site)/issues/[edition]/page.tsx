import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { StoryCard } from '@/components/site/StoryCard'
import { getIssue, issueArticles } from '@/lib/data'
import { editionLabel, editionPath, formatDate } from '@/lib/format'

export const revalidate = 600
export const generateStaticParams = () => []

type Props = { params: Promise<{ edition: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const issue = await getIssue((await params).edition)
  return issue ? { title: `${issue.title} (${editionLabel(issue)})` } : {}
}

export default async function IssuePage({ params }: Props) {
  const issue = await getIssue((await params).edition)
  if (!issue) notFound()
  const articles = issueArticles(issue)

  return (
    <div className="listing">
      <header className="listing__header">
        <p className="kicker">
          {editionLabel(issue)} · {formatDate(issue.date)}
        </p>
        <h1>{issue.title}</h1>
        {issue.printEdition && (
          <p>
            <Link className="button" href={`${editionPath(issue)}/print`}>
              Open the print edition
            </Link>
          </p>
        )}
      </header>
      {articles.map((article) => (
        <StoryCard key={article.id} article={article} variant="row" showSection />
      ))}
    </div>
  )
}
