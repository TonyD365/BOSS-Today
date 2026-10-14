'use client'

import { Button, useAuth, useFormModified } from '@payloadcms/ui'
import React, { useState } from 'react'

import { DeployProgress } from './DeployProgress'

type SidebarUser = { role?: string; isSuperAdmin?: boolean; permissions?: string[] }

/** Banner sidebar: publish the saved banner on its own, without waiting for an issue. */
export function PublishBannerNow() {
  const { user } = useAuth<SidebarUser>()
  const modified = useFormModified()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [deploymentId, setDeploymentId] = useState<number | null>(null)

  const canIssue =
    Boolean(user?.isSuperAdmin) ||
    (['editor', 'exec'].includes(user?.role ?? '') && Boolean(user?.permissions?.includes('issue')))

  if (!canIssue) {
    return <p style={hint}>Saved changes go live with the next issue.</p>
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
      deploy?: { id?: number; status?: string; used?: number; limit?: number }
    }
    setBusy(false)
    if (!response.ok) {
      setMessage(result.message ?? 'Something went wrong.')
      return
    }
    setOpen(false)
    setReason('')
    const deploy = result.deploy
    if (deploy?.status === 'triggered' && deploy.id) {
      setDeploymentId(deploy.id)
      setMessage(`The website is rebuilding (${deploy.used}/${deploy.limit} rebuilds this month).`)
    } else {
      setMessage(
        deploy?.status === 'not-configured'
          ? 'The banner is published, but the Cloudflare deploy hook is not set up, so the website was not rebuilt.'
          : 'The banner is published, but the rebuild request failed. Use “Rebuild site” on the dashboard.',
      )
    }
  }

  return (
    <div style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
      <p style={hint}>
        Saved changes go live with the next issue. If it can’t wait, publish the banner on its own.
        This uses one of this month’s site rebuilds.
      </p>
      {!open ? (
        <Button
          buttonStyle="secondary"
          size="small"
          disabled={busy || modified}
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
              Publish and rebuild
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
      {modified && <p style={hint}>Save the banner first.</p>}
      {message && <p style={hint}>{message}</p>}
      {deploymentId && <DeployProgress deploymentId={deploymentId} />}
    </div>
  )
}

const hint: React.CSSProperties = { margin: 0, fontSize: 13, opacity: 0.8 }
