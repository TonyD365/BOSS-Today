import type { Payload, TypedUser, Where } from 'payload'
import Link from 'next/link'
import { after } from 'next/server'
import React from 'react'

import { canPublishIssues, hasPermission, RANK, rankOf } from '@/access'
import { deploysThisMonth, ISSUE_DEPLOY_LIMIT } from '@/publishing/deploy'
import { readershipSummary, syncReadership } from '@/publishing/readership'
import type { Article, Assignment, Issue } from '@/payload-types'

import { RebuildButton } from './RebuildButton'

type Props = { payload: Payload; user?: TypedUser | null }

const STATE_LABELS: Record<string, string> = {
  draft: 'Draft',
  review: 'In review',
  changes: 'Changes requested',
  approved: 'Waiting for the next issue',
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
  const [returned, drafts, myPublished, queue, recent, issue, waiting, deploys] = await Promise.all(
    [
      stories({ and: [mine, { workflow: { equals: 'changes' } }] }),
      stories({ and: [mine, { workflow: { in: ['draft', 'review', 'approved', 'withdrawn'] } }] }),
      stories({ and: [mine, { workflow: { equals: 'published' } }] }, 5, '-publishedAt'),
      rank >= RANK.editor ? stories({ workflow: { equals: 'review' } }, 20, 'updatedAt') : [],
      rank >= RANK.editor ? stories({ workflow: { equals: 'published' } }, 6, '-publishedAt') : [],
      hasPermission(user, 'print') || canPublishIssues(user)
        ? payload
            .find({ collection: 'issues', draft: true, sort: '-updatedAt', limit: 1, depth: 1 })
            .then((result) => result.docs[0] as Issue | undefined)
        : undefined,
      rank >= RANK.editor ? stories({ workflow: { equals: 'approved' } }, 50, 'updatedAt') : [],
      canPublishIssues(user) ? deploysThisMonth(payload) : undefined,
    ],
  )

  const assignments = (
    await payload.find({
      collection: 'assignments',
      where: { reporters: { in: [user.id] } },
      sort: 'deadline',
      depth: 1,
      limit: 20,
      overrideAccess: true,
    })
  ).docs.filter((assignment) => {
    const story = assignment.article
    return !(story && typeof story === 'object' && story.workflow === 'published')
  })

  const isEditor = rank >= RANK.editor
  const [readership, newSubmissions] = isEditor
    ? await Promise.all([
        readershipSummary(payload),
        payload.count({
          collection: 'submissions',
          where: { status: { equals: 'new' } },
          overrideAccess: true,
        }),
      ])
    : [null, null]
  // Keep readership fresh without making anyone wait: at most hourly, after the page is sent.
  if (isEditor && readership?.configured) {
    after(() => syncReadership(payload).then(() => undefined))
  }

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
        {rank >= RANK.editor && (
          <Card
            title="Waiting for the next issue"
            count={waiting.length}
            empty="Nothing approved yet."
          >
            <StoryList stories={waiting} showState={false} />
          </Card>
        )}
        {rank >= RANK.reporter && (
          <Card
            title="Your assignments"
            count={assignments.length}
            empty="Nothing assigned to you."
          >
            <AssignmentList assignments={assignments} />
            <Link href="/admin/assignment-board" style={link}>
              Open the assignment board
            </Link>
          </Card>
        )}
        <Card title="Sent back to you" count={returned.length} empty="Nothing sent back.">
          <StoryList stories={returned} showState={false} />
        </Card>
        <Card title="Your drafts" count={drafts.length} empty="No drafts in progress.">
          <StoryList stories={drafts} />
          <Link href="/admin/new-story" style={link}>
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
        {newSubmissions && (
          <Card title="Reader submissions">
            <p style={{ margin: 0 }}>
              {newSubmissions.totalDocs === 0
                ? 'Nothing new from readers.'
                : `${newSubmissions.totalDocs} new ${newSubmissions.totalDocs === 1 ? 'message' : 'messages'} from readers.`}
            </p>
            <Link href="/admin/collections/submissions" style={link}>
              Open reader submissions
            </Link>
          </Card>
        )}
        {readership && <ReadershipCard data={readership} />}
        {issue && <IssueCard issue={issue} />}
        {deploys !== undefined && (
          <Card title="Public website">
            <p style={{ margin: 0 }}>
              Rebuilt {deploys} of {ISSUE_DEPLOY_LIMIT} times this month. The site changes only when
              an issue is published or a story is withdrawn.
            </p>
            {process.env.PUBLIC_SITE_URL && (
              <a href={process.env.PUBLIC_SITE_URL} target="_blank" rel="noreferrer" style={link}>
                Open the website ↗
              </a>
            )}
            <RebuildButton />
          </Card>
        )}
      </div>
    </div>
  )
}

const number = (value: number) => value.toLocaleString('en-CA')

function ReadershipCard({ data }: { data: Awaited<ReturnType<typeof readershipSummary>> }) {
  if (!data.configured) {
    return (
      <Card title="Readership">
        <p style={{ margin: 0, opacity: 0.75 }}>
          Not set up yet. Turn on Cloudflare Web Analytics and set CLOUDFLARE_ANALYTICS_SITE_TAG on
          Vercel (see the README).
        </p>
      </Card>
    )
  }
  return (
    <Card title="Readership">
      <p style={{ margin: 0 }}>
        <b>{number(data.week.views)}</b> page views this week · {number(data.month.views)} in 30
        days
      </p>
      {data.topWeek.length > 0 && (
        <div style={{ display: 'grid', gap: 4 }}>
          <strong style={{ fontSize: 13 }}>Most read this week</strong>
          <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4, fontSize: 13 }}>
            {data.topWeek.map((story) => (
              <li key={story.id}>
                <a href={`/admin/collections/articles/${story.id}`}>{story.title}</a>{' '}
                <span style={{ opacity: 0.7 }}>· {number(story.views)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {data.sections.length > 0 && (
        <p style={{ margin: 0, fontSize: 13 }}>
          <strong>By section (30 days): </strong>
          {data.sections.map(([name, views]) => `${name} ${number(views)}`).join(' · ')}
        </p>
      )}
      {data.referrers.length > 0 && (
        <p style={{ margin: 0, fontSize: 13 }}>
          <strong>Readers came from: </strong>
          {data.referrers.map(([host, views]) => `${host} ${number(views)}`).join(' · ')}
        </p>
      )}
      <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>
        {data.lastSync ? `Updated ${when(data.lastSync)}. ` : 'Not updated yet. '}
        Refreshes hourly while editors use the newsroom, and daily on its own.
      </p>
      {data.lastError && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--theme-error-500)' }}>
          Last update failed: {data.lastError.message}
        </p>
      )}
    </Card>
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

function AssignmentList({ assignments }: { assignments: Assignment[] }) {
  if (assignments.length === 0) return null
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
      {assignments.map((assignment) => {
        const story = typeof assignment.article === 'object' ? assignment.article : null
        return (
          <li key={assignment.id}>
            <a
              href={story ? `/admin/collections/articles/${story.id}` : '/admin/assignment-board'}
              style={{ fontWeight: 600 }}
            >
              {assignment.title}
            </a>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Due {when(assignment.deadline)}
              {story ? ` · ${STATE_LABELS[story.workflow ?? 'draft']}` : ' · not started'}
            </div>
          </li>
        )
      })}
    </ul>
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
