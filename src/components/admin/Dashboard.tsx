import type { Payload, TypedUser, Where } from 'payload'
import Link from 'next/link'
import React from 'react'

import { hasPermission, RANK, rankOf } from '@/access'
import type { Article, Issue } from '@/payload-types'

type Props = { payload: Payload; user?: TypedUser | null }

const STATE_LABELS: Record<string, string> = {
  draft: 'Draft',
  review: 'In review',
  changes: 'Changes requested',
  published: 'Published',
  withdrawn: 'Withdrawn',
}

const when = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('en-CA', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/Toronto',
      }).format(new Date(value))
    : ''

/** The first screen after sign-in, tailored to what each role needs to do next. */
export async function Dashboard({ payload, user }: Props) {
  if (!user) return null
  const rank = rankOf(user)

  const stories = async (where: Where, limit = 8, sort = '-updatedAt') =>
    (
      await payload.find({
        collection: 'articles',
        where,
        draft: true,
        depth: 0,
        limit,
        sort,
        select: { title: true, workflow: true, updatedAt: true, publishedAt: true },
      })
    ).docs as Article[]

  const mine: Where = { authors: { in: [user.id] } }
  const [returned, drafts, myPublished, queue, recent, issue] = await Promise.all([
    stories({ and: [mine, { workflow: { equals: 'changes' } }] }),
    stories({ and: [mine, { workflow: { in: ['draft', 'review', 'withdrawn'] } }] }),
    stories({ and: [mine, { workflow: { equals: 'published' } }] }, 5, '-publishedAt'),
    rank >= RANK.editor ? stories({ workflow: { equals: 'review' } }, 20, 'updatedAt') : [],
    rank >= RANK.editor ? stories({ workflow: { equals: 'published' } }, 6, '-publishedAt') : [],
    hasPermission(user, 'print')
      ? payload
          .find({ collection: 'issues', draft: true, sort: '-updatedAt', limit: 1, depth: 1 })
          .then((result) => result.docs[0] as Issue | undefined)
      : undefined,
  ])

  const name = (user as { name?: string }).name?.split(' ')[0]

  return (
    <div style={{ display: 'grid', gap: 24, marginBottom: 32 }}>
      <h2 style={{ margin: 0 }}>{name ? `Hi, ${name}.` : 'Welcome.'}</h2>
      <div style={grid}>
        {rank >= RANK.editor && (
          <Card title="Waiting for review" count={queue.length} empty="Nothing to review.">
            <StoryList stories={queue} showState={false} />
          </Card>
        )}
        <Card title="Sent back to you" count={returned.length} empty="Nothing sent back.">
          <StoryList stories={returned} showState={false} />
        </Card>
        <Card title="Your drafts" count={drafts.length} empty="No drafts in progress.">
          <StoryList stories={drafts} />
          <Link href="/admin/collections/articles/create" style={link}>
            + Write a new story
          </Link>
        </Card>
        <Card
          title="Your published stories"
          count={myPublished.length}
          empty="Nothing published yet."
        >
          <StoryList stories={myPublished} showState={false} />
        </Card>
        {rank >= RANK.editor && (
          <Card title="Recently published" count={recent.length} empty="Nothing published yet.">
            <StoryList stories={recent} showState={false} />
          </Card>
        )}
        {issue && <IssueCard issue={issue} />}
      </div>
    </div>
  )
}

function IssueCard({ issue }: { issue: Issue }) {
  const stories = (issue.stories ?? [])
    .map((story) => story.article)
    .filter((article): article is Article => typeof article === 'object' && article !== null)
  const ready = stories.filter((story) => story._status === 'published').length

  return (
    <Card title={`Latest issue: ${issue.title}`}>
      <p style={{ margin: 0 }}>
        Vol. {issue.volume}, No. {issue.number} ·{' '}
        {issue._status === 'published' ? 'Published' : 'Draft'}
      </p>
      <p style={{ margin: 0 }}>
        {ready} of {stories.length} stories published
        {stories.length > ready ? ` — ${stories.length - ready} still to go` : ''}
      </p>
      <a href={`/admin/collections/issues/${issue.id}`} style={link}>
        Open issue
      </a>
    </Card>
  )
}

function StoryList({ stories, showState = true }: { stories: Article[]; showState?: boolean }) {
  if (stories.length === 0) return null
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
      {stories.map((story) => (
        <li key={story.id}>
          <a href={`/admin/collections/articles/${story.id}`} style={{ fontWeight: 600 }}>
            {story.title || 'Untitled'}
          </a>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {showState && `${STATE_LABELS[story.workflow ?? 'draft']} · `}
            {when(story.updatedAt)}
          </div>
        </li>
      ))}
    </ul>
  )
}

function Card({
  title,
  count,
  empty,
  children,
}: {
  title: string
  count?: number
  empty?: string
  children: React.ReactNode
}) {
  const hasContent = React.Children.toArray(children).some(Boolean)
  return (
    <section
      style={{
        display: 'grid',
        alignContent: 'start',
        gap: 12,
        padding: 16,
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: 4,
      }}
    >
      <h3 style={{ margin: 0, fontSize: 15 }}>
        {title}
        {count ? ` (${count})` : ''}
      </h3>
      {count === 0 && empty ? <p style={{ margin: 0, opacity: 0.7 }}>{empty}</p> : null}
      {hasContent && children}
    </section>
  )
}

const grid: React.CSSProperties = {
  display: 'grid',
  gap: 16,
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
}

const link: React.CSSProperties = { fontSize: 13, fontWeight: 600 }
