'use client'

import { Button } from '@payloadcms/ui'
import React, { useMemo, useState } from 'react'

import { type TemplateChoice, TemplatePicker } from './TemplatePicker'

export type Column = 'open' | 'writing' | 'review' | 'waiting'

export type BoardCard = {
  id: number
  title: string
  brief: string | null
  section: { id: number; name: string } | null
  reporters: { id: number; name: string }[]
  editor: string | null
  deadline: string
  storyId: number | null
  stage: string
  column: Column
}

const COLUMNS: { key: Column; title: string; hint: string }[] = [
  { key: 'open', title: 'Unclaimed', hint: 'Nobody is writing these yet.' },
  { key: 'writing', title: 'Writing', hint: 'Not started, drafting, or sent back.' },
  { key: 'review', title: 'In review', hint: 'Waiting for an editor.' },
  { key: 'waiting', title: 'Waiting for the issue', hint: 'Approved.' },
]

const DAY = 24 * 60 * 60 * 1000

const due = (value: string) =>
  new Intl.DateTimeFormat('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Toronto',
  }).format(new Date(value))

/** The assignment board: four columns that follow each story's review state. */
export function AssignmentBoard({
  cards,
  done,
  me,
  isEditor,
  templates,
}: {
  cards: BoardCard[]
  done: number
  me: number
  isEditor: boolean
  templates: TemplateChoice[]
}) {
  const [now] = useState(() => Date.now())
  const [onlyMine, setOnlyMine] = useState(!isEditor)
  const [section, setSection] = useState('')
  const [reporter, setReporter] = useState('')
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sections = useMemo(
    () => [
      ...new Map(
        cards.flatMap((card) => (card.section ? [[card.section.id, card.section]] : [])),
      ).values(),
    ],
    [cards],
  )
  const people = useMemo(
    () => [...new Map(cards.flatMap((card) => card.reporters.map((p) => [p.id, p]))).values()],
    [cards],
  )

  const shown = cards.filter((card) => {
    const mine = card.reporters.some((person) => person.id === me)
    if (onlyMine && !mine && card.column !== 'open') return false
    if (section && String(card.section?.id) !== section) return false
    if (reporter && !card.reporters.some((person) => String(person.id) === reporter)) return false
    return true
  })

  const claim = async (card: BoardCard) => {
    setBusy(card.id)
    setError(null)
    const response = await fetch(`/api/assignments/${card.id}/claim`, {
      method: 'POST',
      credentials: 'include',
    })
    if (response.ok) {
      window.location.reload()
      return
    }
    const result = (await response.json().catch(() => ({}))) as { message?: string }
    setError(result.message ?? 'Could not claim it.')
    setBusy(null)
  }

  return (
    <div style={{ display: 'grid', gap: 20, margin: '32px 0 64px' }}>
      <header style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'end' }}>
        <div style={{ display: 'grid', gap: 6, flex: '1 1 320px' }}>
          <h1 style={{ margin: 0 }}>Assignment board</h1>
          <p style={{ margin: 0, opacity: 0.75 }}>
            Cards move by themselves as stories are written, reviewed and approved. Published
            stories leave the board ({done} so far).
          </p>
        </div>
        {isEditor && (
          <a href="/admin/collections/assignments/create" style={primaryLink}>
            + New assignment
          </a>
        )}
      </header>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={filter}>
          <input
            type="checkbox"
            checked={onlyMine}
            onChange={(event) => setOnlyMine(event.target.checked)}
          />
          Only mine and unclaimed
        </label>
        <select value={section} onChange={(event) => setSection(event.target.value)} style={select}>
          <option value="">All sections</option>
          {sections.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select
          value={reporter}
          onChange={(event) => setReporter(event.target.value)}
          style={select}
        >
          <option value="">All reporters</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p style={{ margin: 0, color: 'var(--theme-error-500)' }}>{error}</p>}

      <div
        style={{
          display: 'grid',
          gap: 16,
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          alignItems: 'start',
        }}
      >
        {COLUMNS.map((column) => {
          const items = shown.filter((card) => card.column === column.key)
          return (
            <section key={column.key} style={{ display: 'grid', gap: 10 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 15 }}>
                  {column.title} ({items.length})
                </h2>
                <p style={{ margin: 0, fontSize: 12, opacity: 0.65 }}>{column.hint}</p>
              </div>
              {items.map((card) => {
                const left = new Date(card.deadline).getTime() - now
                const late = column.key !== 'waiting' && left < 0
                const soon = column.key !== 'waiting' && !late && left < DAY
                const mine = card.reporters.some((person) => person.id === me)
                return (
                  <article
                    key={card.id}
                    style={{
                      display: 'grid',
                      gap: 6,
                      padding: 12,
                      borderRadius: 4,
                      border: `1px solid ${late ? 'var(--theme-error-500)' : soon ? 'var(--theme-warning-500)' : 'var(--theme-elevation-150)'}`,
                      borderLeftWidth: late || soon ? 4 : 1,
                      background: 'var(--theme-elevation-0)',
                    }}
                  >
                    {card.section && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          opacity: 0.6,
                        }}
                      >
                        {card.section.name}
                      </span>
                    )}
                    <strong style={{ fontSize: 14 }}>{card.title}</strong>
                    {card.brief && (
                      <p style={{ margin: 0, fontSize: 12, opacity: 0.8, whiteSpace: 'pre-wrap' }}>
                        {card.brief.length > 180 ? `${card.brief.slice(0, 180)}…` : card.brief}
                      </p>
                    )}
                    <div style={{ fontSize: 12, display: 'grid', gap: 2 }}>
                      <span
                        style={{
                          color: late
                            ? 'var(--theme-error-500)'
                            : soon
                              ? 'var(--theme-warning-650, var(--theme-warning-500))'
                              : undefined,
                          fontWeight: late || soon ? 700 : 400,
                        }}
                      >
                        {late ? 'Overdue · ' : soon ? 'Due soon · ' : 'Due '}
                        {due(card.deadline)}
                      </span>
                      <span style={{ opacity: 0.75 }}>
                        {card.reporters.length
                          ? card.reporters.map((person) => person.name).join(', ')
                          : 'No reporter yet'}
                        {card.editor ? ` · editor ${card.editor}` : ''}
                      </span>
                      <span style={{ opacity: 0.75 }}>{card.stage}</span>
                    </div>
                    <div
                      style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}
                    >
                      {card.column === 'open' && (
                        <Button
                          buttonStyle="secondary"
                          size="small"
                          disabled={busy !== null}
                          onClick={() => claim(card)}
                          margin={false}
                        >
                          Claim
                        </Button>
                      )}
                      {card.storyId ? (
                        <a href={`/admin/collections/articles/${card.storyId}`} style={smallLink}>
                          Open story
                        </a>
                      ) : (
                        card.column === 'writing' &&
                        (mine || isEditor) && (
                          <TemplatePicker templates={templates} assignmentId={card.id} compact />
                        )
                      )}
                      {isEditor && (
                        <a href={`/admin/collections/assignments/${card.id}`} style={smallLink}>
                          Edit
                        </a>
                      )}
                    </div>
                  </article>
                )
              })}
            </section>
          )
        })}
      </div>
    </div>
  )
}

const filter: React.CSSProperties = { display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }
const select: React.CSSProperties = { font: 'inherit', fontSize: 13, padding: '4px 6px' }
const smallLink: React.CSSProperties = { fontSize: 13, fontWeight: 600 }
const primaryLink: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 4,
  background: 'var(--theme-elevation-800)',
  color: 'var(--theme-elevation-0)',
  fontWeight: 600,
  textDecoration: 'none',
}
