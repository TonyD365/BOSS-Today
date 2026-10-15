'use client'

import { Button, useDocumentInfo, useFormFields, useFormModified } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

/** Sidebar of a reader submission: turn it into a story or an assignment. */
export function SubmissionActions() {
  const { id } = useDocumentInfo()
  const router = useRouter()
  const modified = useFormModified()
  const kind = useFormFields(([fields]) => fields.kind?.value) as string | undefined
  const emailConfirmed = useFormFields(([fields]) => fields.emailConfirmed?.value) as boolean
  const identityConfirmed = useFormFields(([fields]) => fields.identityConfirmed?.value) as boolean
  const story = useFormFields(([fields]) => fields.story?.value)
  const assignment = useFormFields(([fields]) => fields.assignment?.value)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!id) return null

  const run = async (action: 'to-story' | 'to-assignment') => {
    setBusy(true)
    setError(null)
    const response = await fetch(`/api/submissions/${id}/${action}`, {
      method: 'POST',
      credentials: 'include',
    })
    const result = (await response.json().catch(() => ({}))) as { id?: number; message?: string }
    if (!response.ok || !result.id) {
      setError(result.message ?? 'Something went wrong.')
      setBusy(false)
      return
    }
    router.push(
      action === 'to-story'
        ? `/admin/collections/articles/${result.id}`
        : `/admin/collections/assignments/${result.id}`,
    )
  }

  const idOf = (value: unknown) =>
    value && typeof value === 'object' ? (value as { id: number }).id : (value as number)

  return (
    <div style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
      {kind === 'letter' &&
        (story ? (
          <a href={`/admin/collections/articles/${idOf(story)}`}>Open the letter’s story →</a>
        ) : (
          <>
            <Button
              buttonStyle="primary"
              size="small"
              margin={false}
              disabled={busy || modified || !emailConfirmed || !identityConfirmed}
              onClick={() => run('to-story')}
            >
              Turn into a story
            </Button>
            {(!emailConfirmed || !identityConfirmed) && (
              <p style={hint}>
                Email the writer from your own address first. Once they reply, tick “Email
                confirmed” and “Identity confirmed” and save.
              </p>
            )}
          </>
        ))}
      {kind === 'tip' &&
        (assignment ? (
          <a href={`/admin/collections/assignments/${idOf(assignment)}`}>Open the assignment →</a>
        ) : (
          <Button
            buttonStyle="primary"
            size="small"
            margin={false}
            disabled={busy || modified}
            onClick={() => run('to-assignment')}
          >
            Put on the assignment board
          </Button>
        ))}
      {kind === 'correction' && (
        <p style={hint}>
          Check the story. If it’s wrong, add a correction to it, then reply to the reader and mark
          this “Replied”.
        </p>
      )}
      {modified && <p style={hint}>Save your changes first.</p>}
      {error && <p style={{ ...hint, color: 'var(--theme-error-500)', opacity: 1 }}>{error}</p>}
    </div>
  )
}

const hint: React.CSSProperties = { margin: 0, fontSize: 13, opacity: 0.8 }
