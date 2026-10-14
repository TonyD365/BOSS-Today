'use client'

import React, { useEffect, useState } from 'react'

type Progress = {
  available: boolean
  status?: 'queued' | 'building' | 'live' | 'failed' | 'canceled'
  stageLabel?: string
  percent?: number
  stages?: { name: string; label: string; status: string }[]
  startedAt?: string
  finishedAt?: string | null
  siteUrl?: string | null
  message?: string
}

const ICONS: Record<string, string> = {
  success: '✓',
  active: '●',
  failure: '✕',
  canceled: '✕',
  skipped: '–',
  idle: '○',
}

const FINISHED = ['live', 'failed', 'canceled']

/**
 * Follows one rebuild of the public site on Cloudflare, checking every few
 * seconds until it is live or has failed. Pass a rebuild id, or "latest".
 */
export function DeployProgress({
  deploymentId,
  issueId,
}: {
  deploymentId: number | string | 'latest'
  /** With "latest": only rebuilds for this issue. */
  issueId?: number | string
}) {
  const [id, setId] = useState<number | string | null>(
    deploymentId === 'latest' ? null : deploymentId,
  )
  const [progress, setProgress] = useState<Progress | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (deploymentId !== 'latest') return
    let cancelled = false
    fetch(`/api/deployments/latest${issueId ? `?issue=${issueId}` : ''}`, {
      credentials: 'include',
    })
      .then((response) => response.json())
      .then((body: { id?: number | null }) => {
        if (!cancelled && body.id) setId(body.id)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [deploymentId, issueId])

  useEffect(() => {
    if (id === null) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const poll = async () => {
      try {
        const response = await fetch(`/api/deployments/${id}/progress`, { credentials: 'include' })
        const body = (await response.json()) as Progress
        if (cancelled) return
        setProgress(body)
        if (body.available && !FINISHED.includes(body.status ?? '')) timer = setTimeout(poll, 4000)
      } catch {
        if (!cancelled) timer = setTimeout(poll, 8000)
      }
    }
    void poll()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [id])

  useEffect(() => {
    if (!progress || FINISHED.includes(progress.status ?? '')) return
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [progress])

  if (id === null && deploymentId === 'latest') return null
  if (!progress) return <p style={note}>Checking the website rebuild…</p>
  if (!progress.available) return <p style={note}>{progress.message}</p>

  const started = progress.startedAt ? new Date(progress.startedAt).getTime() : undefined
  const ended = progress.finishedAt ? new Date(progress.finishedAt).getTime() : now
  const seconds = started ? Math.max(0, Math.round((ended - started) / 1000)) : undefined
  const color =
    progress.status === 'live'
      ? 'var(--theme-success-500)'
      : progress.status === 'failed' || progress.status === 'canceled'
        ? 'var(--theme-error-500)'
        : 'var(--theme-elevation-800)'

  return (
    <div style={{ display: 'grid', gap: 10 }} aria-live="polite">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
        <strong style={{ color }}>
          {progress.status === 'live'
            ? 'The website is up to date'
            : progress.status === 'failed'
              ? 'The rebuild failed'
              : progress.status === 'canceled'
                ? 'The rebuild was canceled'
                : `${progress.stageLabel}…`}
        </strong>
        {seconds !== undefined && (
          <span style={{ opacity: 0.7 }}>
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
          </span>
        )}
      </div>
      <div
        role="progressbar"
        aria-valuenow={progress.percent ?? 0}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          height: 8,
          borderRadius: 4,
          background: 'var(--theme-elevation-100)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progress.percent ?? 0}%`,
            height: '100%',
            background: color,
            transition: 'width 0.6s ease',
          }}
        />
      </div>
      <ol
        style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 4, fontSize: 13 }}
      >
        {(progress.stages ?? []).map((stage) => (
          <li
            key={stage.name}
            style={{ display: 'flex', gap: 8, opacity: stage.status === 'idle' ? 0.5 : 1 }}
          >
            <span style={{ width: 14, textAlign: 'center' }}>{ICONS[stage.status] ?? '○'}</span>
            {stage.label}
          </li>
        ))}
      </ol>
      {progress.status === 'live' && progress.siteUrl && (
        <a
          href={progress.siteUrl}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 13, fontWeight: 600 }}
        >
          Open the website ↗
        </a>
      )}
      {progress.status === 'failed' && (
        <p style={note}>
          Open the Cloudflare dashboard to see the build log, then use “Rebuild site now” to try
          again.
        </p>
      )}
    </div>
  )
}

const note: React.CSSProperties = { margin: 0, fontSize: 13, opacity: 0.8 }
