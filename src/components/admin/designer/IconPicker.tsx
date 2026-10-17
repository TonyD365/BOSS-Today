'use client'

import React, { useEffect, useMemo, useState } from 'react'

import type { IconPath } from '@/design/types'

type Icon = [name: string, words: string, paths: IconPath[]]

let cache: Promise<Icon[]> | null = null
const loadIcons = () => {
  cache ??= fetch('/designer/icons.json')
    .then((r) => (r.ok ? (r.json() as Promise<Icon[]>) : []))
    .catch(() => {
      cache = null
      return []
    })
  return cache
}

const Preview = ({ paths }: { paths: IconPath[] }) => (
  <svg
    viewBox="0 0 24 24"
    width="28"
    height="28"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {paths.map((p, i) =>
      typeof p === 'string' ? (
        <path key={i} d={p} />
      ) : (
        <path key={i} d={p[0]} fill="currentColor" stroke="none" />
      ),
    )}
  </svg>
)

/** Search the Tabler icon set (MIT licence) and pick one. */
export function IconPicker({
  onPick,
  onClose,
}: {
  onPick: (name: string, paths: IconPath[]) => void
  onClose: () => void
}) {
  const [icons, setIcons] = useState<Icon[] | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    loadIcons().then(setIcons)
  }, [])

  const matches = useMemo(() => {
    if (!icons) return []
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    const found = words.length
      ? icons.filter(([name, tags]) => words.every((w) => name.includes(w) || tags.includes(w)))
      : icons
    return found.slice(0, 160)
  }, [icons, query])

  return (
    <div className="dz-menu-backdrop" onPointerDown={onClose}>
      <div
        className="dz-icons"
        role="dialog"
        aria-label="Add an icon"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="dz-icons__head">
          <input
            className="dz-input"
            autoFocus
            placeholder="Search icons: trophy, ball, book, calendar…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
          />
          <button type="button" className="dz-button" onClick={onClose}>
            Close
          </button>
        </div>
        {!icons ? (
          <p className="dz-hint">Loading icons…</p>
        ) : matches.length === 0 ? (
          <p className="dz-hint">No icons match. Try a simpler word.</p>
        ) : (
          <div className="dz-icons__grid">
            {matches.map(([name, , paths]) => (
              <button
                key={name}
                type="button"
                title={name.replace(/-/g, ' ')}
                onClick={() => onPick(name, paths)}
              >
                <Preview paths={paths} />
              </button>
            ))}
          </div>
        )}
        <p className="dz-hint">
          {icons ? `${icons.length.toLocaleString()} icons` : ''} from Tabler Icons (MIT licence).
        </p>
      </div>
    </div>
  )
}
