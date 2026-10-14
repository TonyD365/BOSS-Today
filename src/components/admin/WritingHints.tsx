'use client'

import { useFormFields } from '@payloadcms/ui'
import React, { useEffect, useMemo, useState } from 'react'

import { readingMinutes, wordCount } from '@/lib/text'

const HEADLINE_LIMIT = 70
const SUMMARY_LIMIT = 240

type Node = { type?: string; value?: unknown; children?: Node[] }
type ImageInfo = { id: number; alt?: string | null; credit?: string | null; filename?: string }

const idOf = (value: unknown): number | null => {
  if (value && typeof value === 'object') return Number((value as { id: unknown }).id) || null
  return Number(value) || null
}

/** Images placed inside the story body. */
const bodyImageIds = (content: unknown): number[] => {
  const ids: number[] = []
  const walk = (node: Node | undefined) => {
    if (!node) return
    if (node.type === 'upload') {
      const id = idOf(node.value)
      if (id) ids.push(id)
    }
    node.children?.forEach(walk)
  }
  walk((content as { root?: Node } | null)?.root)
  return ids
}

/** Alt text that only repeats the file name, or says nothing, doesn't help readers. */
const weakAlt = (image: ImageInfo) => {
  const alt = image.alt?.trim().toLowerCase() ?? ''
  const name = image.filename?.replace(/\.[a-z0-9]+$/i, '').toLowerCase() ?? ''
  return alt.length < 5 || alt === name || ['image', 'photo', 'picture', 'img'].includes(alt)
}

/**
 * Live notes beside the editor: length, reading time and easy-to-miss gaps.
 * They are only reminders; saving is never blocked here.
 */
export function WritingHints() {
  const title = useFormFields(([fields]) => fields.title?.value) as string | undefined
  const summary = useFormFields(([fields]) => fields.summary?.value) as string | undefined
  const content = useFormFields(([fields]) => fields.content?.value)
  const hero = useFormFields(([fields]) => fields.heroImage?.value)
  const section = useFormFields(([fields]) => fields.section?.value)
  const authors = useFormFields(([fields]) => fields.authors?.value) as unknown[] | undefined

  const words = useMemo(() => wordCount(content), [content])
  const minutes = useMemo(() => readingMinutes(content), [content])
  const heroId = idOf(hero)
  const imageIds = useMemo(
    () => [...new Set([...(heroId ? [heroId] : []), ...bodyImageIds(content)])],
    [heroId, content],
  )
  const imageKey = imageIds.join(',')
  const [images, setImages] = useState<ImageInfo[]>([])

  useEffect(() => {
    if (!imageKey) return
    let cancelled = false
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ depth: '0', limit: '50', 'where[id][in]': imageKey })
      fetch(`/api/media?${query}`, { credentials: 'include' })
        .then((response) => response.json())
        .then((body: { docs?: ImageInfo[] }) => {
          if (!cancelled) setImages(body.docs ?? [])
        })
        .catch(() => undefined)
    }, 600)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [imageKey])

  const headlineLength = title?.trim().length ?? 0
  const summaryLength = summary?.trim().length ?? 0
  const shown = images.filter((image) => imageIds.includes(image.id))
  const notes: { text: string; strong?: boolean }[] = []

  if (headlineLength > HEADLINE_LIMIT) {
    notes.push({
      text: `The headline is ${headlineLength} characters. Under ${HEADLINE_LIMIT} reads best.`,
    })
  }
  if (summaryLength === 0)
    notes.push({ text: 'Write a summary before sending for review.', strong: true })
  else if (summaryLength > SUMMARY_LIMIT) {
    notes.push({ text: `The summary is over ${SUMMARY_LIMIT} characters.`, strong: true })
  }
  if (!heroId) notes.push({ text: 'No lead image. Stories with a photo get more readers.' })
  const noCredit = shown.filter((image) => !image.credit?.trim()).length
  if (noCredit > 0) {
    notes.push({
      text: `${noCredit === 1 ? 'An image has' : `${noCredit} images have`} no photo credit.`,
    })
  }
  const vagueAlt = shown.filter(weakAlt).length
  if (vagueAlt > 0) {
    notes.push({
      text: `${vagueAlt === 1 ? 'An image needs' : `${vagueAlt} images need`} a better description (alt text) for readers who can’t see it.`,
    })
  }
  if (!section) notes.push({ text: 'Choose a section.', strong: true })
  if (!authors || authors.length === 0)
    notes.push({ text: 'Add at least one author.', strong: true })

  return (
    <div
      style={{
        display: 'grid',
        gap: 8,
        marginBottom: 24,
        padding: 12,
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: 4,
      }}
    >
      <strong style={{ fontSize: 13 }}>Writing notes</strong>
      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: '2px 12px',
          margin: 0,
          fontSize: 13,
        }}
      >
        <dt style={label}>Words</dt>
        <dd style={value}>{words.toLocaleString('en-CA')}</dd>
        <dt style={label}>Reading time</dt>
        <dd style={value}>{words === 0 ? '—' : `${minutes} min`}</dd>
        <dt style={label}>Headline</dt>
        <dd style={{ ...value, color: headlineLength > HEADLINE_LIMIT ? warn : undefined }}>
          {headlineLength} characters
        </dd>
        <dt style={label}>Summary</dt>
        <dd style={{ ...value, color: summaryLength > SUMMARY_LIMIT ? error : undefined }}>
          {summaryLength} / {SUMMARY_LIMIT}
        </dd>
      </dl>
      {notes.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, display: 'grid', gap: 4 }}>
          {notes.map((note) => (
            <li key={note.text} style={{ color: note.strong ? error : warn }}>
              {note.text}
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--theme-success-500)' }}>
          Nothing missing.
        </p>
      )}
    </div>
  )
}

const label: React.CSSProperties = { opacity: 0.7 }
const value: React.CSSProperties = { margin: 0 }
const warn = 'var(--theme-warning-650, var(--theme-warning-500))'
const error = 'var(--theme-error-500)'
