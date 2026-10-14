'use client'

import { Button, useAuth, useDocumentInfo, useFormFields, useFormModified } from '@payloadcms/ui'
import React, { useState } from 'react'

import { DeployProgress } from './DeployProgress'

type State = 'draft' | 'review' | 'changes' | 'approved' | 'published' | 'withdrawn'
type Action = 'submit' | 'return' | 'approve' | 'withdraw'

const LABELS: Record<State, string> = {
  draft: 'Draft',
  review: 'In review',
  changes: 'Changes requested',
  approved: 'Waiting for the next issue',
  published: 'Published',
  withdrawn: 'Withdrawn',
}

const COLORS: Record<State, string> = {
  draft: 'var(--theme-elevation-500)',
  review: 'var(--theme-warning-500)',
  changes: 'var(--theme-error-500)',
  approved: 'var(--theme-success-250, var(--theme-success-500))',
  published: 'var(--theme-success-500)',
  withdrawn: 'var(--theme-elevation-500)',
}

const RANKS: Record<string, number> = { reader: 0, reporter: 1, editor: 2, exec: 3 }

type PanelUser = {
  id: number
  role?: string
  isSuperAdmin?: boolean
  permissions?: string[]
}

/** The review workflow, shown in the sidebar of every story. */
export function WorkflowPanel() {
  const { id, hasPublishedDoc, unpublishedVersionCount } = useDocumentInfo()
  const { user } = useAuth<PanelUser>()
  const state = (useFormFields(([fields]) => fields.workflow?.value) ?? 'draft') as State
  const modified = useFormModified()
  const [note, setNote] = useState('')
  const [mode, setMode] = useState<'return' | 'withdraw' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [withdrawnDeploy, setWithdrawnDeploy] = useState<number | null>(null)

  const rank = user?.isSuperAdmin ? 4 : (RANKS[user?.role ?? 'reader'] ?? 0)
  const isEditor = rank >= 2
  const canIssue =
    Boolean(user?.isSuperAdmin) || (rank >= 2 && Boolean(user?.permissions?.includes('issue')))

  if (!id) {
    return (
      <Panel state="draft">
        <p style={hint}>Save a draft first. Then you can send it to an editor for review.</p>
      </Panel>
    )
  }

  const act = async (action: Action) => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/articles/${id}/workflow`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      })
      const result = (await response.json().catch(() => ({}))) as {
        message?: string
        deploy?: { id?: number; status?: string }
      }
      if (!response.ok) throw new Error(result.message ?? 'Something went wrong.')
      if (action === 'withdraw' && result.deploy?.id) {
        setWithdrawnDeploy(result.deploy.id)
        setMode(null)
        setBusy(false)
        return
      }
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setBusy(false)
    }
  }

  if (withdrawnDeploy) {
    return (
      <Panel state="withdrawn">
        <p style={hint}>Withdrawn. The website is being rebuilt without this story.</p>
        <DeployProgress deploymentId={withdrawnDeploy} />
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            ...hint,
            textAlign: 'left',
            textDecoration: 'underline',
            background: 'none',
            border: 0,
            padding: 0,
            cursor: 'pointer',
          }}
        >
          Reload this story
        </button>
      </Panel>
    )
  }

  const needsSave = modified && (
    <p style={hint}>You have unsaved changes. Save the draft before moving the story on.</p>
  )

  return (
    <Panel state={state}>
      {hasPublishedDoc && state !== 'published' && (
        <p style={hint}>
          An earlier version is on the website. These changes go live with the next issue once
          approved.
        </p>
      )}
      {needsSave}

      {['draft', 'changes', 'withdrawn'].includes(state) && (
        <Button
          buttonStyle="primary"
          size="small"
          disabled={busy || modified}
          onClick={() => act('submit')}
        >
          Submit for review
        </Button>
      )}

      {isEditor &&
        state !== 'approved' &&
        (state !== 'published' || unpublishedVersionCount > 0) && (
          <Button
            buttonStyle="primary"
            size="small"
            disabled={busy || modified}
            onClick={() => act('approve')}
          >
            {state === 'published'
              ? 'Approve changes for the next issue'
              : 'Approve for the next issue'}
          </Button>
        )}

      {isEditor && ['review', 'approved'].includes(state) && mode !== 'return' && (
        <Button
          buttonStyle="secondary"
          size="small"
          disabled={busy}
          onClick={() => setMode('return')}
        >
          Send back to reporter
        </Button>
      )}

      {canIssue && hasPublishedDoc && mode !== 'withdraw' && (
        <Button
          buttonStyle="secondary"
          size="small"
          disabled={busy}
          onClick={() => setMode('withdraw')}
        >
          Emergency withdrawal…
        </Button>
      )}

      {mode && (
        <div style={{ display: 'grid', gap: 8 }}>
          {mode === 'withdraw' && (
            <p style={{ ...hint, color: 'var(--theme-error-500)' }}>
              This takes the story off the website right away and rebuilds the site. Use it only for
              errors, privacy or policy problems.
            </p>
          )}
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={
              mode === 'return'
                ? 'What should the reporter change?'
                : 'Why is this being withdrawn?'
            }
            rows={3}
            style={{ width: '100%', font: 'inherit', padding: 8 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              buttonStyle="primary"
              size="small"
              disabled={busy || !note.trim()}
              onClick={() => act(mode)}
            >
              {mode === 'return' ? 'Send back' : 'Withdraw now'}
            </Button>
            <Button
              buttonStyle="secondary"
              size="small"
              disabled={busy}
              onClick={() => setMode(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {!isEditor && state === 'review' && <p style={hint}>Waiting for an editor.</p>}
      {!isEditor && state === 'approved' && (
        <p style={hint}>Approved. It will go live when the next issue is published.</p>
      )}
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
      className="workflow-panel"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[state] }} />
        {LABELS[state]}
      </div>
      {children}
    </div>
  )
}
