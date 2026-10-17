'use client'

import { Button, useAuth, useDocumentInfo } from '@payloadcms/ui'
import React, { useCallback, useEffect, useState } from 'react'

type PanelUser = { isSuperAdmin?: boolean; role?: string; permissions?: string[] }

/** Take all of an issue's stories off the website with the next issue or rebuild. */
export function IssueTakedown() {
  const { id } = useDocumentInfo()
  const { user } = useAuth<PanelUser>()
  const [counts, setCounts] = useState<{ live: number; comingDown: number } | null>(null)
  const [asking, setAsking] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const canIssue =
    Boolean(user?.isSuperAdmin) ||
    (['editor', 'exec'].includes(user?.role ?? '') && Boolean(user?.permissions?.includes('issue')))

  const load = useCallback(() => {
    if (!id) return
    fetch(`/api/issues/${id}/takedown`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setCounts)
      .catch(() => undefined)
  }, [id])
  useEffect(load, [load])

  if (!id || !canIssue || !counts) return null
  if (counts.live === 0) {
    return (
      <div style={{ display: 'grid', gap: 8, marginBottom: 24 }}>
        <strong style={{ fontSize: 13 }}>Take this issue down</strong>
        <p style={hint}>None of this issue’s stories are on the website.</p>
      </div>
    )
  }

  const send = async (body: { note?: string; keep?: boolean }) => {
    setBusy(true)
    const response = await fetch(`/api/issues/${id}/takedown`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null)
    const result = (await response?.json().catch(() => ({}))) as { message?: string }
    setBusy(false)
    if (!response?.ok) {
      setMessage(result?.message ?? 'Something went wrong.')
      return
    }
    setAsking(false)
    setNote('')
    setMessage(null)
    load()
  }

  const allDown = counts.comingDown === counts.live
  return (
    <div style={{ display: 'grid', gap: 8, marginBottom: 24 }}>
      <strong style={{ fontSize: 13 }}>Take this issue down</strong>
      <p style={hint}>
        {counts.live} of its stories {counts.live === 1 ? 'is' : 'are'} on the website
        {counts.comingDown > 0 ? `; ${counts.comingDown} coming down` : ''}.
        {counts.comingDown > 0 &&
          ' They come off when the next issue is published or the site is rebuilt.'}
      </p>
      {!allDown && !asking && (
        <Button
          buttonStyle="secondary"
          size="small"
          disabled={busy}
          onClick={() => setAsking(true)}
        >
          Take down all its stories…
        </Button>
      )}
      {asking && (
        <>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Why are these stories coming down?"
            style={{ width: '100%', font: 'inherit', padding: 8 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              buttonStyle="primary"
              size="small"
              disabled={busy || !note.trim()}
              onClick={() => send({ note })}
            >
              Take down with the next issue or rebuild
            </Button>
            <Button
              buttonStyle="secondary"
              size="small"
              disabled={busy}
              onClick={() => setAsking(false)}
            >
              Cancel
            </Button>
          </div>
        </>
      )}
      {counts.comingDown > 0 && (
        <Button
          buttonStyle="secondary"
          size="small"
          disabled={busy}
          onClick={() => send({ keep: true })}
        >
          Keep them all on the site
        </Button>
      )}
      {message && <p style={{ ...hint, color: 'var(--theme-error-500)' }}>{message}</p>}
    </div>
  )
}

const hint: React.CSSProperties = { margin: 0, fontSize: 13, opacity: 0.8 }
