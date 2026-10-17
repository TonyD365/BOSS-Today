'use client'

import { Button } from '@payloadcms/ui'
import React, { useCallback, useEffect, useState } from 'react'

import { DeployProgress } from './DeployProgress'

type Story = {
  id: number
  title: string
  section: string | null
  authors: string[]
  updatedAt: string
  inIssue: boolean
  live: boolean
  problems: string[]
}

type Review = {
  issue: {
    id: number
    title: string
    volume: number
    number: number
    printEdition?: boolean
    published: boolean
  }
  stories: Story[]
  sections: { id: number; name: string }[]
  tags: { id: number; name: string }[]
  pages: { id: number; title: string }[]
  takedowns: { id: number; title: string; reason: string }[]
  frontPage: boolean
  settings: boolean
  banner: boolean
  design: boolean
  designPhoneUnchecked: boolean
  deploys: { used: number; limit: number }
  checked: { article: number; version: string; at: string }[]
  declaration: string
}

const when = (value: string) =>
  new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )

const post = async (url: string, body: unknown) => {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const result = (await response.json().catch(() => ({}))) as Record<string, unknown> & {
    message?: string
  }
  if (!response.ok) throw new Error(result.message ?? 'Something went wrong.')
  return result
}

/**
 * The publisher reads every waiting story, ticks it (recorded on the server with
 * their name and the time), or sends it back. Publishing needs every tick plus
 * the declaration.
 */
export function PublishChecklist({ issueId }: { issueId: string }) {
  const [review, setReview] = useState<Review | null>(null)
  const [opened, setOpened] = useState<Set<number>>(new Set())
  const [sendBack, setSendBack] = useState<{ id: number; note: string } | null>(null)
  const [structureChecked, setStructureChecked] = useState(false)
  const [declaration, setDeclaration] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [deploymentId, setDeploymentId] = useState<number | null>(null)

  const fetchReview = useCallback(
    () =>
      fetch(`/api/issues/${issueId}/review`, { credentials: 'include' }).then(async (response) => ({
        ok: response.ok,
        body: (await response.json().catch(() => ({}))) as Review & { message?: string },
      })),
    [issueId],
  )

  const load = useCallback(async () => {
    const { ok, body } = await fetchReview()
    if (ok) setReview(body)
    else setError(body.message ?? 'Could not load the issue.')
  }, [fetchReview])

  useEffect(() => {
    let cancelled = false
    fetchReview().then(({ ok, body }) => {
      if (cancelled) return
      if (ok) setReview(body)
      else setError(body.message ?? 'Could not load the issue.')
    })
    return () => {
      cancelled = true
    }
  }, [fetchReview])

  if (error && !review)
    return <p style={{ marginTop: 40, color: 'var(--theme-error-500)' }}>{error}</p>
  if (!review) return <p style={{ marginTop: 40 }}>Loading…</p>

  const isChecked = (story: Story) =>
    review.checked.some(
      (check) => String(check.article) === String(story.id) && check.version === story.updatedAt,
    )
  const checkedAt = (story: Story) =>
    review.checked.find(
      (check) => String(check.article) === String(story.id) && check.version === story.updatedAt,
    )?.at

  const run = async (task: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await task()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const tick = (story: Story) =>
    run(() =>
      post(`/api/issues/${issueId}/check`, {
        article: story.id,
        updatedAt: story.updatedAt,
        action: 'checked',
      }),
    )

  const doSendBack = () =>
    sendBack &&
    run(async () => {
      const story = review.stories.find((item) => item.id === sendBack.id)
      await post(`/api/issues/${issueId}/check`, {
        article: sendBack.id,
        updatedAt: story?.updatedAt,
        action: 'sent-back',
        note: sendBack.note,
      })
      setSendBack(null)
    })

  const publish = () =>
    run(async () => {
      const result = (await post(`/api/issues/${issueId}/publish`, {
        structureChecked,
        declaration,
      })) as {
        published?: number
        deploy?: { id?: number; status?: string; used?: number; limit?: number; message?: string }
        bannerWarning?: string
      }
      const deploy = result.deploy?.status
      if (deploy === 'triggered' && result.deploy?.id) setDeploymentId(result.deploy.id)
      setDone(
        `Published ${result.published ?? 0} stories. ` +
          (deploy === 'triggered'
            ? `The website is rebuilding (${result.deploy?.used}/${result.deploy?.limit} rebuilds this month).`
            : deploy === 'not-configured'
              ? 'The Cloudflare deploy hook is not set up yet, so the website was not rebuilt.'
              : (result.deploy?.message ??
                'The rebuild request failed. Use “Rebuild site” on the dashboard to try again.')) +
          (result.bannerWarning ? ` ${result.bannerWarning}` : ''),
      )
    })

  if (done) {
    return (
      <div style={{ display: 'grid', gap: 16, marginTop: 40, maxWidth: 720 }}>
        <h1 style={{ margin: 0 }}>{review.issue.title} is published</h1>
        <p style={{ margin: 0 }}>{done}</p>
        {deploymentId && <DeployProgress deploymentId={deploymentId} />}
        <a href={`/admin/collections/issues/${issueId}`}>Back to the issue</a>
      </div>
    )
  }

  const { issue, stories } = review
  const hasStructure =
    review.sections.length > 0 ||
    review.tags.length > 0 ||
    review.takedowns.length > 0 ||
    review.pages.length > 0 ||
    review.frontPage ||
    review.settings ||
    review.banner ||
    review.design
  const allChecked = stories.every(isChecked)
  const budgetLeft = review.deploys.limit - review.deploys.used
  const canPublish =
    !issue.published &&
    allChecked &&
    (!hasStructure || structureChecked) &&
    declaration &&
    budgetLeft > 0 &&
    (stories.length > 0 || hasStructure)

  return (
    <div style={{ display: 'grid', gap: 24, margin: '32px 0 64px', maxWidth: 860 }}>
      <header style={{ display: 'grid', gap: 6 }}>
        <p style={{ margin: 0, opacity: 0.7 }}>
          Vol. {issue.volume}, No. {issue.number} · Site rebuilds this month: {review.deploys.used}/
          {review.deploys.limit}
        </p>
        <h1 style={{ margin: 0 }}>Review &amp; publish: {issue.title}</h1>
        <p style={{ margin: 0 }}>
          Read every story below in full before ticking it. Each tick is recorded with your name and
          the time, and publishing records you as the person who approved this issue. If something
          is wrong, send the story back instead: it will not go out with this issue.
        </p>
      </header>

      {issue.published && (
        <p style={{ color: 'var(--theme-error-500)' }}>This issue is already published.</p>
      )}

      <section style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>
          Stories going live ({stories.filter(isChecked).length}/{stories.length} checked)
        </h2>
        {stories.length === 0 && <p style={{ margin: 0, opacity: 0.7 }}>No stories are waiting.</p>}
        {stories.map((story) => {
          const checked = isChecked(story)
          const blocked = story.problems.length > 0
          const canTick = opened.has(story.id) && !checked && !blocked
          return (
            <div
              key={story.id}
              style={{
                display: 'grid',
                gap: 8,
                padding: 14,
                border: `1px solid ${checked ? 'var(--theme-success-500)' : blocked ? 'var(--theme-error-500)' : 'var(--theme-elevation-150)'}`,
                borderRadius: 4,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <strong>{story.title}</strong>
                  <div style={{ fontSize: 13, opacity: 0.75 }}>
                    {[story.section, story.authors.join(', ')].filter(Boolean).join(' · ')}
                    {story.live ? ' · update to a published story' : ''}
                    {!story.inIssue ? ' · web only (not in the print edition)' : ''}
                  </div>
                </div>
                <a
                  href={`/preview/articles/${story.id}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setOpened((current) => new Set(current).add(story.id))}
                >
                  Read the full story ↗
                </a>
              </div>
              {blocked && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--theme-error-500)' }}>
                  Can’t be published yet: {story.problems.join('; ')}.{' '}
                  <a
                    href={`/admin/collections/articles/${story.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Fix the story ↗
                  </a>{' '}
                  or send it back.
                </p>
              )}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <label
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    opacity: canTick || checked ? 1 : 0.5,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!canTick || busy}
                    onChange={() => tick(story)}
                  />
                  {checked
                    ? `Checked by you, ${when(checkedAt(story)!)}`
                    : blocked
                      ? 'Fix the problem above first'
                      : opened.has(story.id)
                        ? 'I have read this story in full and it is fit to publish'
                        : 'Open and read the story first'}
                </label>
                {!checked && sendBack?.id !== story.id && (
                  <Button
                    buttonStyle="secondary"
                    size="small"
                    disabled={busy}
                    onClick={() => setSendBack({ id: story.id, note: '' })}
                  >
                    Send back
                  </Button>
                )}
              </div>
              {sendBack?.id === story.id && (
                <div style={{ display: 'grid', gap: 8 }}>
                  <textarea
                    rows={3}
                    value={sendBack.note}
                    onChange={(event) => setSendBack({ id: story.id, note: event.target.value })}
                    placeholder="What is wrong? The reporter will see this."
                    style={{ width: '100%', font: 'inherit', padding: 8 }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                      buttonStyle="primary"
                      size="small"
                      disabled={busy || !sendBack.note.trim()}
                      onClick={doSendBack}
                    >
                      Send back and leave out of this issue
                    </Button>
                    <Button
                      buttonStyle="secondary"
                      size="small"
                      disabled={busy}
                      onClick={() => setSendBack(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </section>

      {hasStructure && (
        <section style={{ display: 'grid', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Other changes going live</h2>
          <ul style={{ margin: 0 }}>
            {review.sections.map((section) => (
              <li key={section.id}>
                Section: <a href={`/admin/collections/sections/${section.id}`}>{section.name}</a>
              </li>
            ))}
            {review.tags.map((tag) => (
              <li key={`tag-${tag.id}`}>
                Tag: <a href={`/admin/collections/tags/${tag.id}`}>{tag.name}</a>
              </li>
            ))}
            {review.takedowns.map((story) => (
              <li key={`down-${story.id}`}>
                <strong style={{ color: 'var(--theme-error-500)' }}>Coming down:</strong>{' '}
                <a href={`/admin/collections/articles/${story.id}`}>{story.title}</a>
                {story.reason && <span> — {story.reason}</span>}
              </li>
            ))}
            {review.pages.map((page) => (
              <li key={`page-${page.id}`}>
                Page:{' '}
                <a href={`/admin/site-designer?page=${page.id}`} target="_blank" rel="noreferrer">
                  {page.title}
                </a>
              </li>
            ))}
            {review.frontPage && (
              <li>
                <a href="/admin/globals/front-page">Front page</a> arrangement
              </li>
            )}
            {review.settings && (
              <li>
                <a href="/admin/globals/settings">Site settings</a>
              </li>
            )}
            {review.design && (
              <li>
                <a href="/admin/site-designer" target="_blank" rel="noreferrer">
                  Site design
                </a>{' '}
                (front page, header and footer)
              </li>
            )}
            {review.banner && (
              <li>
                <a href="/admin/globals/banner">Banner</a>
              </li>
            )}
          </ul>
          {review.designPhoneUnchecked && (
            <p style={{ margin: 0, color: 'var(--theme-warning-650, var(--theme-warning-500))' }}>
              A designed layout changed on desktop since anyone checked how it looks on phones. Open
              the designer, look at the phone view, and mark it checked.
            </p>
          )}
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={structureChecked}
              onChange={(event) => setStructureChecked(event.target.checked)}
            />
            I have reviewed these changes
          </label>
        </section>
      )}

      <section
        style={{
          display: 'grid',
          gap: 12,
          padding: 16,
          border: '2px solid var(--theme-elevation-800)',
          borderRadius: 4,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>Publisher’s declaration</h2>
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <input
            type="checkbox"
            checked={declaration}
            disabled={!allChecked}
            onChange={(event) => setDeclaration(event.target.checked)}
            style={{ marginTop: 4 }}
          />
          <span>{review.declaration}</span>
        </label>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>
          Your name, this declaration and the time are kept permanently with the issue.
        </p>
        <Button buttonStyle="primary" disabled={!canPublish || busy} onClick={publish}>
          Publish issue and rebuild the website
        </Button>
        {budgetLeft <= 0 && (
          <p style={{ margin: 0, color: 'var(--theme-error-500)' }}>
            The site has been rebuilt {review.deploys.used} times this month. Publishing resumes on
            the 1st.
          </p>
        )}
      </section>

      {error && (
        <p role="alert" style={{ margin: 0, color: 'var(--theme-error-500)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
