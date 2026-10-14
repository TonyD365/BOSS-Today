'use client'

import { useRowLabel } from '@payloadcms/ui'
import React, { useEffect, useState } from 'react'

const WIDTHS: Record<string, string> = {
  full: 'full width',
  twoThirds: 'two-thirds',
  half: 'half',
  column: 'one column',
}

/** Shows each story's headline in the issue's story list instead of "Story 01". */
export function StoryRowLabel() {
  const { data, rowNumber } = useRowLabel<{ article?: number | { id: number }; width?: string }>()
  const id = typeof data?.article === 'object' ? data.article?.id : data?.article
  const [title, setTitle] = useState<string>()

  useEffect(() => {
    if (!id) return
    let cancelled = false
    fetch(`/api/articles/${id}?depth=0&draft=true&select[title]=true`, { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((doc) => !cancelled && setTitle(doc?.title))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [id])

  const position = (rowNumber ?? 0) + 1
  const label = id ? (title ?? 'Loading…') : 'Choose a story'
  return (
    <span>
      {position === 1 ? 'Lead' : position}. {label}
      {data?.width ? ` · ${WIDTHS[data.width] ?? data.width}` : ''}
    </span>
  )
}
