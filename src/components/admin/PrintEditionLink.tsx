'use client'

import { Button, useAuth, useDocumentInfo, useFormFields, useFormModified } from '@payloadcms/ui'
import React, { useState } from 'react'

import { DeployProgress } from './DeployProgress'

type SidebarUser = { role?: string; isSuperAdmin?: boolean; permissions?: string[] }

/** Issue sidebar: fill in waiting stories, proof the print edition, and go to review & publish. */
export function PrintEditionLink() {
  const { id, hasPublishedDoc } = useDocumentInfo()
  const { user } = useAuth<SidebarUser>()
  const modified = useFormModified()
  const volume = useFormFields(([fields]) => fields.volume?.value)
  const number = useFormFields(([fields]) => fields.number?.value)
  const printEdition = useFormFields(([fields]) => fields.printEdition?.value)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const canIssue =
    Boolean(user?.isSuperAdmin) ||
    (['editor', 'exec'].includes(user?.role ?? '') && Boolean(user?.permissions?.includes('issue')))

  if (!id) {
    return <p style={hint}>Save the issue first. Then you can add stories and publish it.</p>
  }

  const addWaiting = async () => {
    setBusy(true)
    setMessage(null)
    const response = await fetch(`/api/issues/${id}/add-waiting`, {
      method: 'POST',
      credentials: 'include',
    })
    const result = (await response.json().catch(() => ({}))) as { added?: number; message?: string }
    if (!response.ok) {
      setMessage(result.message ?? 'Something went wrong.')
      setBusy(false)
      return
    }
    if (result.added) window.location.reload()
    else {
      setMessage('Every waiting story is already in this issue.')
      setBusy(false)
    }
  }

  const proof = volume && number ? `/issues/${volume}-${number}/print` : null

  return (
    <div style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
      {!hasPublishedDoc && (
        <Button
          buttonStyle="secondary"
          size="small"
          disabled={busy || modified}
          onClick={addWaiting}
        >
          Add all waiting stories
        </Button>
      )}
      {printEdition && proof ? (
        <a href={proof} target="_blank" rel="noreferrer">
          Proof the print edition ↗
        </a>
      ) : null}
      {canIssue && !hasPublishedDoc && (
        <a
          href={`/admin/publish-issue?id=${id}`}
          style={{
            display: 'block',
            padding: '10px 12px',
            borderRadius: 4,
            background: 'var(--theme-elevation-800)',
            color: 'var(--theme-elevation-0)',
            fontWeight: 600,
            textAlign: 'center',
            textDecoration: 'none',
          }}
        >
          Review &amp; publish this issue →
        </a>
      )}
      {hasPublishedDoc && (
        <p style={hint}>This issue is published. Start a new issue for new stories.</p>
      )}
      {hasPublishedDoc && canIssue && <DeployProgress deploymentId="latest" issueId={id} />}
      {modified && <p style={hint}>Save your changes first.</p>}
      {message && <p style={hint}>{message}</p>}
    </div>
  )
}

const hint: React.CSSProperties = { margin: 0, fontSize: 13, opacity: 0.8 }
