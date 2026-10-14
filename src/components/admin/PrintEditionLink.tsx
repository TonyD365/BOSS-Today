'use client'

import { useFormFields } from '@payloadcms/ui'
import React from 'react'

/** Sidebar links from an issue to its web page and its typeset print edition. */
export function PrintEditionLink() {
  const volume = useFormFields(([fields]) => fields.volume?.value)
  const number = useFormFields(([fields]) => fields.number?.value)
  const printEdition = useFormFields(([fields]) => fields.printEdition?.value)

  if (!volume || !number) return null
  const base = `/issues/${volume}-${number}`

  return (
    <div style={{ display: 'grid', gap: 8, marginBottom: 24 }}>
      <a href={base} target="_blank" rel="noreferrer">
        View issue on the site ↗
      </a>
      {printEdition ? (
        <a href={`${base}/print`} target="_blank" rel="noreferrer">
          Open print edition ↗
        </a>
      ) : null}
      <small style={{ opacity: 0.7 }}>
        Save the issue first; drafts are visible to staff only.
      </small>
    </div>
  )
}
