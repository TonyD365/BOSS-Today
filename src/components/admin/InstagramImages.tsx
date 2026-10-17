'use client'

import { useDocumentInfo, useFormFields } from '@payloadcms/ui'
import React, { useState } from 'react'

/**
 * "Instagram images" in the story sidebar: a post (1080×1350) and a story
 * (1080×1920) with the lead photo, section and headline under the masthead.
 * Drawn in the browser, so the server does no work.
 */
const SIZES = {
  post: { width: 1080, height: 1350, label: 'Post' },
  story: { width: 1080, height: 1920, label: 'Story' },
} as const
type Kind = keyof typeof SIZES

const INK = '#121212'
const PAPER = '#ffffff'
const FONTS_CSS =
  'https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@600&family=Manufacturing+Consent&family=Newsreader:opsz,wght@6..72,700&display=swap'

const loadFonts = async () => {
  if (!document.querySelector(`link[href="${FONTS_CSS}"]`)) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = FONTS_CSS
    document.head.appendChild(link)
    await new Promise((resolve) => {
      link.onload = resolve
      link.onerror = resolve
    })
  }
  await Promise.all([
    document.fonts.load("400 80px 'Manufacturing Consent'"),
    document.fonts.load("700 80px 'Newsreader'"),
    document.fonts.load("600 30px 'Libre Franklin'"),
  ])
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = src
  })

/** Breaks text into lines that fit the width. */
const wrap = (ctx: CanvasRenderingContext2D, text: string, width: number) => {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > width && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

const draw = async (
  kind: Kind,
  {
    title,
    section,
    photo,
    siteName,
  }: { title: string; section: string; photo: string | null; siteName: string },
) => {
  const { width, height } = SIZES[kind]
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const image = photo ? await loadImage(photo) : null
  const margin = 72
  const ink = image ? PAPER : INK

  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, width, height)
  if (image) {
    const scale = Math.max(width / image.width, height / image.height)
    const w = image.width * scale
    const h = image.height * scale
    ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h)
    const shade = ctx.createLinearGradient(0, 0, 0, height)
    shade.addColorStop(0, 'rgba(0,0,0,0.55)')
    shade.addColorStop(0.22, 'rgba(0,0,0,0.05)')
    shade.addColorStop(0.5, 'rgba(0,0,0,0.25)')
    shade.addColorStop(1, 'rgba(0,0,0,0.9)')
    ctx.fillStyle = shade
    ctx.fillRect(0, 0, width, height)
  }

  // Masthead, section and the thick-and-thin rule.
  const top = kind === 'story' ? 150 : 90
  ctx.fillStyle = ink
  ctx.textBaseline = 'alphabetic'
  ctx.font = "400 76px 'Manufacturing Consent'"
  ctx.fillText(siteName, margin, top)
  if (section) {
    ctx.font = "600 28px 'Libre Franklin'"
    const label = section.toUpperCase().split('').join(' ')
    ctx.fillText(label, width - margin - ctx.measureText(label).width, top - 6)
  }
  ctx.fillRect(margin, top + 26, width - margin * 2, 4)
  ctx.fillRect(margin, top + 34, width - margin * 2, 1.5)

  // The headline, as big as fits.
  const bottom = height - (kind === 'story' ? 260 : 110)
  let size = 104
  let lines: string[] = []
  for (; size >= 52; size -= 4) {
    ctx.font = `700 ${size}px 'Newsreader'`
    lines = wrap(ctx, title, width - margin * 2)
    if (lines.length <= 6) break
  }
  const lineHeight = size * 1.08
  const headlineTop = image
    ? bottom - lines.length * lineHeight
    : (height - lines.length * lineHeight) / 2 + size
  ctx.fillStyle = ink
  lines.forEach((line, i) =>
    ctx.fillText(line, margin, headlineTop + i * lineHeight + (image ? size : 0)),
  )

  // How to read it.
  ctx.font = "600 30px 'Libre Franklin'"
  ctx.fillStyle = ink
  const call =
    kind === 'story' ? 'Read the full story · link below' : 'Read the full story · link in bio'
  ctx.fillText(call, margin, height - (kind === 'story' ? 170 : 56))

  return new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob(resolve, 'image/png')
    } catch {
      resolve(null)
    }
  })
}

export function InstagramImages() {
  const { id } = useDocumentInfo()
  const fields = useFormFields(([f]) => ({
    title: String(f.title?.value ?? ''),
    slug: String(f.slug?.value ?? 'story'),
    hero: f.heroImage?.value as number | { id: number } | null | undefined,
    section: f.section?.value as number | { id: number } | null | undefined,
  }))
  const [busy, setBusy] = useState<Kind | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!id) return null

  const make = async (kind: Kind) => {
    setBusy(kind)
    setError(null)
    try {
      const idOf = (v: typeof fields.hero) => (v && typeof v === 'object' ? v.id : v)
      const get = (url: string) =>
        fetch(url, { credentials: 'include' }).then((r) => (r.ok ? r.json() : null))
      const [media, section, settings] = await Promise.all([
        idOf(fields.hero) ? get(`/api/media/${idOf(fields.hero)}?depth=0`) : null,
        idOf(fields.section) ? get(`/api/sections/${idOf(fields.section)}?depth=0`) : null,
        get('/api/globals/settings?depth=0'),
      ])
      await loadFonts()
      const photo = media ? (media.sizes?.hero?.url ?? media.url ?? null) : null
      const blob = await draw(kind, {
        title: fields.title || 'Untitled story',
        section: section?.name ?? '',
        photo,
        siteName: settings?.siteName || 'BOSS Today',
      })
      if (!blob) {
        setError('Could not make the picture (the photo could not be read).')
        return
      }
      const url = URL.createObjectURL(blob)
      setPreview(url)
      const link = document.createElement('a')
      link.href = url
      link.download = `${fields.slug}-instagram-${kind}.png`
      link.click()
    } catch {
      setError('Could not make the picture. Check your connection and try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ margin: '0 0 24px' }}>
      <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Instagram images</p>
      <div style={{ display: 'flex', gap: 8 }}>
        {(Object.keys(SIZES) as Kind[]).map((kind) => (
          <button
            key={kind}
            type="button"
            className="btn btn--style-secondary btn--size-small"
            style={{ margin: 0 }}
            disabled={busy !== null}
            onClick={() => make(kind)}
          >
            {busy === kind ? 'Making…' : `${SIZES[kind].label} ↓`}
          </button>
        ))}
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 12, opacity: 0.7 }}>
        Uses the headline, section and lead image as they are now.
      </p>
      {error && (
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--theme-error-500)' }}>{error}</p>
      )}
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt=""
          style={{
            marginTop: 8,
            width: '100%',
            maxWidth: 220,
            border: '1px solid var(--theme-elevation-150)',
          }}
        />
      )}
    </div>
  )
}
