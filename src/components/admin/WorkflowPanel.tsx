'use client'

import { Button, useAuth, useDocumentInfo, useFormFields, useFormModified } from '@payloadcms/ui'
import React, { useState } from 'react'

type State = 'draft' | 'review' | 'changes' | 'published' | 'withdrawn'

const LABELS: Record<State, string> = {
  draft: 'Draft',
  review: 'In review',
  changes: 'Changes requested',
  published: 'Published',
  withdrawn: 'Withdrawn',
}

const COLORS: Record<State, string> = {
  draft: 'var(--theme-elevation-500)',
  review: 'var(--theme-warning-500)',
  changes: 'var(--theme-error-500)',
  published: 'var(--theme-success-500)',
  withdrawn: 'var(--theme-elevation-500)',
}

const RANKS: Record<string, number> = { reader: 0, reporter: 1, editor: 2, exec: 3 }

/** The review workflow, shown in the sidebar of every story. */
export function WorkflowPanel() {
  const { id } = useDocumentInfo()
  const { user } = useAuth<{ id: number; role?: string; isSuperAdmin?: boolean }>()
  const state = (useFormFields(([fields]) => fields.workflow?.value) ?? 'draft') as State
  const modified = useFormModified()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditor = Boolean(user?.isSuperAdmin) || (RANKS[user?.role ?? 'reader'] ?? 0) >= 2

  if (!id) {
    return (
      <Panel state="draft">
        <p style={hint}>Save a draft first. Then you can send it to an editor for review.</p>
      </Panel>
    )
  }

  const act = async (action: 'submit' | 'return' | 'publish' | 'withdraw') => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/articles/${id}/workflow`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      })
      const result = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok) throw new Error(result.message ?? 'Something went wrong.')
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setBusy(false)
    }
  }

  const canSubmit = ['draft', 'changes', 'withdrawn'].includes(state)

  return (
    <Panel state={state}>
      {modified && (
        <p style={hint}>You have unsaved changes. Save the draft before moving the story on.</p>
      )}

      {canSubmit && (
        <Button
          buttonStyle="primary"
          size="small"
          disabled={busy || modified}
          onClick={() => act('submit')}
        >
          Submit for review
        </Button>
      )}

      {isEditor && state !== 'published' && (
        <Button
          buttonStyle="primary"
          size="small"
          disabled={busy || modified}
          onClick={() => act('publish')}
        >
          Publish
        </Button>
      )}

      {isEditor && state === 'review' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What should the reporter change?"
            rows={3}
            style={{ width: '100%', font: 'inherit', padding: 8 }}
          />
          <Button
            buttonStyle="secondary"
            size="small"
            disabled={busy || !note.trim()}
            onClick={() => act('return')}
          >
            Return to reporter
          </Button>
        </div>
      )}

      {isEditor && state === 'published' && (
        <Button
          buttonStyle="secondary"
          size="small"
          disabled={busy}
          onClick={() => act('withdraw')}
        >
          Withdraw from the site
        </Button>
      )}

      {!isEditor && state === 'review' && <p style={hint}>Waiting for an editor.</p>}
      {!isEditor && state === 'published' && (
        <p style={hint}>Published stories can only be changed by an editor.</p>
      )}
      {error && (
        <p role="alert" style={{ ...hint, color: 'var(--theme-error-500)' }}>
          {error}
        </p>
      )}
    </Panel>
  )
}

const hint: React.CSSProperties = { margin: 0, fontSize: 13, opacity: 0.8 }

function Panel({ state, children }: { state: State; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 10,
        padding: 14,
        marginBottom: 24,
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[state] }} />
        {LABELS[state]}
      </div>
      {children}
    </div>
  )
}
