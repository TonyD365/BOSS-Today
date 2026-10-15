'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import React, { useEffect, useState } from 'react'

/** "1,234 readers" in the story sidebar, once the story is on the website. */
export function StoryViews() {
  const { id, hasPublishedDoc } = useDocumentInfo()
  const [views, setViews] = useState<number | null>(null)

  useEffect(() => {
    if (!id || !hasPublishedDoc) return
    let cancelled = false
    fetch(`/api/articles/${id}/views`, { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { views?: number | null } | null) => {
        if (!cancelled && typeof body?.views === 'number') setViews(body.views)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [id, hasPublishedDoc])

  if (views === null) return null
  return (
    <p style={{ margin: '0 0 24px', fontSize: 13 }}>
      <b>{views.toLocaleString('en-CA')}</b> page views on the website so far.
    </p>
  )
}
