import config from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { RANK, rankOf } from '@/access'
import { ArticleBody } from '@/components/site/ArticleBody'
import { Byline } from '@/components/site/Byline'
import { Picture } from '@/components/site/Picture'
import { PrintButton } from '@/components/site/PrintButton'
import { getIssue, getSettings, getStaffBox, issueStories, type IssueStory } from '@/lib/data'
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

const FRACTION: Record<IssueStory['width'], number> = {
  full: 1,
  twoThirds: 2 / 3,
  half: 1 / 2,
  column: 0,
}

/** How many of the page's columns a story spans. */
const spanFor = (width: IssueStory['width'], columns: number) =>
  Math.max(1, Math.min(columns, Math.round(columns * FRACTION[width])))

type Props = { params: Promise<{ edition: string }> }

export default async function PrintEditionPage({ params }: Props) {
  const { edition } = await params

  // Staff can proof an issue before it is published; readers only get published ones.
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  const isStaff = rankOf(user) >= RANK.reporter

  const issue = await getIssue(edition, { includeDrafts: isStaff })
  if (!issue || (!issue.printEdition && !isStaff)) notFound()

  const [settings, staff] = await Promise.all([
    getSettings(),
    issue.showStaffBox !== false ? getStaffBox() : Promise.resolve([]),
  ])
  const stories = issueStories(issue, isStaff)
  const paperSize = issue.paperSize ?? 'letter'
  const paper = PAPER[paperSize]
  const [lead, ...rest] = stories
  const showSidebar = issue.showContents !== false || Boolean(issue.announcement)
  const leadSpan = lead
    ? Math.min(spanFor(lead.width, paper.columns), showSidebar ? paper.columns - 1 : paper.columns)
    : 0

  return (
    <>
      <style>{`@page { size: ${paper.size}; margin: 0.5in 0.5in 0.65in; }`}</style>

      <div className="print-toolbar">
        <Link href={editionPath(issue)}>← Back to the issue</Link>
        <span>
          {issue._status !== 'published' && <strong>Draft proof · </strong>}
          {paperSize.toUpperCase()} · {paper.columns} columns
        </span>
        <span className="print-toolbar__actions">
          <a className="button button--secondary" href={`${editionPath(issue)}/pdf`}>
            Download PDF
          </a>
          <PrintButton />
        </span>
      </div>

      <div className="paper" style={{ '--columns': paper.columns } as React.CSSProperties}>
        <header className="paper__masthead">
          <p className="paper__ears">
            <span>{editionLabel(issue)}</span>
            <span>Bur Oak Secondary School</span>
            <span>{formatDate(issue.date)}</span>
          </p>
          <h1>{settings.siteName}</h1>
          <p className="paper__title">{issue.title}</p>
        </header>

        <div className="paper__grid">
          {lead && <Story story={lead} span={leadSpan} lead />}

          {showSidebar && (
            <aside className="paper__sidebar" style={{ gridColumn: 'span 1' }}>
              {issue.announcement && (
                <section className="paper__notice">
                  <h2>Notice</h2>
                  <p>{issue.announcement}</p>
                </section>
              )}
              {issue.showContents !== false && rest.length > 0 && (
                <section className="paper__contents">
                  <h2>Inside</h2>
                  <ol>
                    {rest.map(({ article }) => (
                      <li key={article.id}>
                        <span>{articleSection(article)?.name}</span>
                        {article.title}
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </aside>
          )}

          {rest.map((story) => (
            <Story
              key={story.article.id}
              story={story}
              span={spanFor(story.width, paper.columns)}
            />
          ))}

          {staff.length > 0 && (
            <aside className="paper__staff" style={{ gridColumn: 'span 1' }}>
              <h2>{settings.siteName} Staff</h2>
              <ul>
                {staff.map((person) => (
                  <li key={`${person.name}-${person.title}`}>
                    <strong>{person.name}</strong> {person.title}
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      </div>
    </>
  )
}

function Story({ story, span, lead = false }: { story: IssueStory; span: number; lead?: boolean }) {
  const { article } = story
  const image = story.showImage ? asMedia(article.heroImage) : undefined

  return (
    <article
      className={`paper__story${lead ? ' paper__story--lead' : ''}`}
      style={{ gridColumn: `span ${span}`, '--span': span } as React.CSSProperties}
    >
      {!lead && <p className="paper__kicker">{articleSection(article)?.name}</p>}
      <h2>{article.title}</h2>
      {lead && <p className="paper__summary">{article.summary}</p>}
      <div className="paper__columns">
        {image && (
          <figure>
            <Picture media={image} sizes={lead ? '100vw' : '50vw'} priority={lead} />
            {(image.caption || image.credit) && (
              <figcaption>
                {image.caption} {image.credit}
              </figcaption>
            )}
          </figure>
        )}
        <p className="paper__byline">
          <Byline authors={articleAuthors(article)} linked={false} />
        </p>
        <ArticleBody content={article.content} print />
      </div>
    </article>
  )
}
