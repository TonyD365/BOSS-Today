import config from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { ArticleBody } from '@/components/site/ArticleBody'
import { Byline } from '@/components/site/Byline'
import { Picture } from '@/components/site/Picture'
import { PrintButton } from '@/components/site/PrintButton'
import { getIssue, issueArticles } from '@/lib/data'
import {
  articleAuthors,
  articleSection,
  asMedia,
  editionLabel,
  editionPath,
  formatDate,
} from '@/lib/format'

import './print.css'

export const metadata: Metadata = { title: 'Print edition', robots: { index: false } }

const PAPER = {
  letter: { size: '8.5in 11in', columns: 3 },
  a4: { size: 'A4', columns: 3 },
  tabloid: { size: '11in 17in', columns: 5 },
  a3: { size: 'A3', columns: 5 },
} as const

type Props = { params: Promise<{ edition: string }> }

export default async function PrintEditionPage({ params }: Props) {
  const { edition } = await params

  // Staff can proof an issue before it is published; readers only get published ones.
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  const isStaff = Boolean(user)

  const issue = await getIssue(edition, { includeDrafts: isStaff })
  if (!issue || (!issue.printEdition && !isStaff)) notFound()

  const articles = issueArticles(issue, isStaff)
  const paperSize = issue.paperSize ?? 'letter'
  const paper = PAPER[paperSize]
  const [lead, ...rest] = articles

  return (
    <>
      <style>{`@page { size: ${paper.size}; margin: 0.5in 0.5in 0.65in; }`}</style>

      <div className="print-toolbar">
        <Link href={editionPath(issue)}>← Back to the issue</Link>
        <span>
          {issue._status !== 'published' && <strong>Draft proof · </strong>}
          {paperSize.toUpperCase()} · {paper.columns} columns
        </span>
        <PrintButton />
      </div>

      <div className="paper" style={{ '--columns': paper.columns } as React.CSSProperties}>
        <header className="paper__masthead">
          <p className="paper__ears">
            <span>{editionLabel(issue)}</span>
            <span>Bur Oak Secondary School</span>
            <span>{formatDate(issue.date)}</span>
          </p>
          <h1>BOSS Today</h1>
          <p className="paper__title">{issue.title}</p>
        </header>

        {lead && (
          <article className="paper__story paper__story--lead">
            <h2>{lead.title}</h2>
            <p className="paper__summary">{lead.summary}</p>
            <div className="paper__columns">
              {asMedia(lead.heroImage) && (
                <figure>
                  <Picture media={asMedia(lead.heroImage)} sizes="100vw" priority />
                  <figcaption>
                    {asMedia(lead.heroImage)?.caption} {asMedia(lead.heroImage)?.credit}
                  </figcaption>
                </figure>
              )}
              <p className="paper__byline">
                <Byline authors={articleAuthors(lead)} linked={false} />
              </p>
              <ArticleBody content={lead.content} print />
            </div>
          </article>
        )}

        {rest.map((article) => {
          const image = asMedia(article.heroImage)
          return (
            <article className="paper__story" key={article.id}>
              <p className="paper__kicker">{articleSection(article)?.name}</p>
              <h2>{article.title}</h2>
              <div className="paper__columns">
                {image && (
                  <figure>
                    <Picture media={image} sizes="50vw" />
                    <figcaption>
                      {image.caption} {image.credit}
                    </figcaption>
                  </figure>
                )}
                <p className="paper__byline">
                  <Byline authors={articleAuthors(article)} linked={false} />
                </p>
                <ArticleBody content={article.content} print />
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}
