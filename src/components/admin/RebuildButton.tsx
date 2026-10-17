'use client'

import { Button } from '@payloadcms/ui'
import React, { useState } from 'react'

import { DeployProgress } from './DeployProgress'

/** Rebuilds the public site without publishing anything new (e.g. after a failed rebuild). */
export function RebuildButton() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [deploymentId, setDeploymentId] = useState<number | null>(null)

  const rebuild = async () => {
    // Stories marked to come down are taken off with the rebuild; say so first.
    const marked = await fetch(
      '/api/articles?draft=true&limit=0&depth=0&where[workflow][equals]=takedown',
      { credentials: 'include' },
    )
      .then((r) => (r.ok ? r.json() : { totalDocs: 0 }))
      .then((body: { totalDocs?: number }) => body.totalDocs ?? 0)
      .catch(() => 0)
    const down =
      marked > 0
        ? `\n\n${marked} ${marked === 1 ? 'story marked to come down is' : 'stories marked to come down are'} taken off the website with it.`
        : ''
    if (
      !window.confirm(
        `Rebuild the public website now? This uses one of this month’s rebuilds.${down}`,
      )
    )
      return
    setBusy(true)
    const response = await fetch('/api/deployments/rebuild', {
      method: 'POST',
      credentials: 'include',
    })
    const result = (await response.json().catch(() => ({}))) as {
      message?: string
      deploy?: { id?: number; status?: string; used?: number; limit?: number; message?: string }
    }
    setBusy(false)
    if (!response.ok) setMessage(result.message ?? 'Something went wrong.')
    else if (result.deploy?.status === 'triggered') {
      setMessage(`Rebuild ${result.deploy.used}/${result.deploy.limit} this month.`)
      if (result.deploy.id) setDeploymentId(result.deploy.id)
    } else if (result.deploy?.status === 'not-configured') {
      setMessage('The Cloudflare deploy hook is not set up yet.')
    } else setMessage(result.deploy?.message ?? 'The rebuild request failed.')
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <Button buttonStyle="secondary" size="small" disabled={busy} onClick={rebuild}>
        Rebuild site now
      </Button>
      {message && <p style={{ margin: 0, fontSize: 13 }}>{message}</p>}
      <DeployProgress key={deploymentId ?? 'latest'} deploymentId={deploymentId ?? 'latest'} />
    </div>
  )
}
