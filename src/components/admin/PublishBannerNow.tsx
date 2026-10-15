'use client'

import { Button, useAuth, useFormFields, useFormModified } from '@payloadcms/ui'
import React, { useState } from 'react'

type SidebarUser = { role?: string; isSuperAdmin?: boolean; permissions?: string[] }

/** Banner sidebar: publish the saved banner on its own, without waiting for an issue. */
export function PublishBannerNow() {
  const { user } = useAuth<SidebarUser>()
  const modified = useFormModified()
  const expiresAt = useFormFields(([fields]) => fields.expiresAt?.value) as string | undefined
  const text = useFormFields(([fields]) => fields.text?.value) as string | undefined
  // Checked when the page loads and whenever the time is changed.
  const [now] = useState(() => Date.now())
  const expired = Boolean(text?.trim() && expiresAt && new Date(expiresAt).getTime() <= now)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const canIssue =
    Boolean(user?.isSuperAdmin) ||
    (['editor', 'exec'].includes(user?.role ?? '') && Boolean(user?.permissions?.includes('issue')))

  const warning = expired ? (
    <p style={{ ...hint, color: 'var(--theme-error-500)', opacity: 1 }}>
      “Hide after” has already passed, so readers would never see this banner. Choose a later time
      or clear it, then save.
    </p>
  ) : null

  if (!canIssue) {
    return (
      <div style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
        {warning}
        <p style={hint}>Saved changes go live with the next issue.</p>
      </div>
    )
  }

  const publish = async () => {
    setBusy(true)
    setMessage(null)
    const response = await fetch('/api/globals/banner/publish-now', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    const result = (await response.json().catch(() => ({}))) as {
      message?: string
      resent?: boolean
    }
    setBusy(false)
    if (!response.ok) {
      setMessage(result.message ?? 'Something went wrong.')
      return
    }
    setOpen(false)
    setReason('')
    setMessage(
      result.resent
        ? 'Sent the published banner to the website again. Readers see it within a minute.'
        : 'Published. Readers see the change within a minute.',
    )
  }

  return (
    <div style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
      <p style={hint}>
        Saved changes go live with the next issue. If it can’t wait, publish the banner on its own.
        This doesn’t rebuild the website or use any of the monthly rebuilds.
      </p>
      {!open ? (
        <Button
          buttonStyle="secondary"
          size="small"
          disabled={busy || modified || expired}
          onClick={() => setOpen(true)}
        >
          Publish banner now
        </Button>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          <textarea
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why can’t this wait for the next issue?"
            style={{ width: '100%', font: 'inherit', padding: 8 }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button
              buttonStyle="primary"
              size="small"
              disabled={busy || !reason.trim()}
              onClick={publish}
            >
              Publish banner
            </Button>
            <Button
              buttonStyle="secondary"
              size="small"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      {warning}
      {modified && <p style={hint}>Save the banner first.</p>}
      {message && <p style={hint}>{message}</p>}
    </div>
  )
}

const hint: React.CSSProperties = { margin: 0, fontSize: 13, opacity: 0.8 }
