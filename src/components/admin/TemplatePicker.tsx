'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

export type TemplateChoice = { id: number; name: string; description: string | null }

/**
 * Starts a story, blank or from a template. With `assignmentId` the story is
 * created for that assignment instead (headline, section and authors filled in).
 */
export function TemplatePicker({
  templates,
  assignmentId,
  compact = false,
}: {
  templates: TemplateChoice[]
  assignmentId?: number
  compact?: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = async (template: number | null) => {
    setBusy(true)
    setError(null)
    const response = await fetch(
      assignmentId ? `/api/assignments/${assignmentId}/start` : '/api/articles/new-story',
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template }),
      },
    )
    const result = (await response.json().catch(() => ({}))) as { id?: number; message?: string }
    if (!response.ok || !result.id) {
      setError(result.message ?? 'Could not create the story.')
      setBusy(false)
      return
    }
    router.push(`/admin/collections/articles/${result.id}`)
  }

  if (compact) {
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          disabled={busy}
          defaultValue=""
          onChange={(event) => {
            const value = event.target.value
            if (value) start(value === 'blank' ? null : Number(value))
          }}
          style={{ font: 'inherit', fontSize: 13, padding: '4px 6px' }}
          aria-label="Start writing"
        >
          <option value="" disabled>
            Start writing…
          </option>
          <option value="blank">Blank story</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
        {error && <span style={{ color: 'var(--theme-error-500)', fontSize: 12 }}>{error}</span>}
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 20, margin: '32px 0 64px', maxWidth: 860 }}>
      <header style={{ display: 'grid', gap: 6 }}>
        <h1 style={{ margin: 0 }}>New story</h1>
        <p style={{ margin: 0 }}>
          Start blank or from a template. Templates fill in a structure with prompts marked{' '}
          <b>TK</b> (“to come”); replace every TK before sending the story for review.
        </p>
      </header>
      <div
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        }}
      >
        {[{ id: null, name: 'Blank story', description: 'An empty story.' }, ...templates].map(
          (template) => (
            <button
              key={template.id ?? 'blank'}
              type="button"
              disabled={busy}
              onClick={() => start(template.id)}
              style={{
                display: 'grid',
                gap: 6,
                alignContent: 'start',
                padding: 16,
                textAlign: 'left',
                font: 'inherit',
                color: 'inherit',
                background: 'var(--theme-elevation-0)',
                border: '1px solid var(--theme-elevation-150)',
                borderRadius: 4,
                cursor: busy ? 'wait' : 'pointer',
              }}
            >
              <strong>{template.name}</strong>
              {template.description && (
                <span style={{ fontSize: 13, opacity: 0.75 }}>{template.description}</span>
              )}
            </button>
          ),
        )}
      </div>
      {error && <p style={{ margin: 0, color: 'var(--theme-error-500)' }}>{error}</p>}
    </div>
  )
}
