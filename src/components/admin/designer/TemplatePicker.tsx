'use client'

import React, { useEffect, useState } from 'react'

import { builtInTemplates } from '@/design/defaults'
import { canvasSize, DesignCanvas, type DesignData } from '@/design/render'
import { cleanDesign } from '@/design/sanitize'
import type { Design } from '@/design/types'

type Saved = { id: number; name: string; design: Design }

const THUMB = 220

function Thumb({ design, data }: { design: Design; data: DesignData }) {
  const size = canvasSize(design, 'desktop')
  const unit = THUMB / size.width
  return (
    <div className="dz-template__thumb" style={{ height: Math.min(260, size.height * unit) }}>
      <DesignCanvas design={design} view="desktop" data={data} unit={unit} publicOnly={false} />
    </div>
  )
}

/** Start from a ready-made layout or one saved earlier, or save the current one. */
export function TemplatePicker({
  current,
  data,
  sections,
  canEdit,
  onUse,
  onClose,
}: {
  current: Design
  data: DesignData
  sections: { id: number; name: string }[]
  canEdit: boolean
  onUse: (design: Design) => void
  onClose: () => void
}) {
  const [saved, setSaved] = useState<Saved[] | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = () =>
    fetch('/api/design-templates?limit=50&depth=0&sort=-updatedAt', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { docs: [] }))
      .then((body: { docs: Saved[] }) => setSaved(body.docs))
      .catch(() => setSaved([]))

  useEffect(() => {
    load()
  }, [])

  const use = (design: Design, name: string) => {
    if (window.confirm(`Replace everything on this canvas with “${name}”? You can undo it.`)) {
      onUse(structuredClone(cleanDesign(design)))
      onClose()
    }
  }

  const save = async () => {
    const name = window.prompt('Name for this template:')?.trim()
    if (!name) return
    const response = await fetch('/api/design-templates', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, design: current }),
    }).catch(() => null)
    setMessage(response?.ok ? `Saved “${name}”.` : 'Could not save the template.')
    load()
  }

  const remove = async (template: Saved) => {
    if (!window.confirm(`Delete the template “${template.name}”?`)) return
    await fetch(`/api/design-templates/${template.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    load()
  }

  return (
    <div className="dz-menu-backdrop" onPointerDown={onClose}>
      <div
        className="dz-icons dz-templates"
        role="dialog"
        aria-label="Templates"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="dz-icons__head">
          <strong style={{ flex: 1 }}>Templates</strong>
          {canEdit && (
            <button type="button" className="dz-button" onClick={save}>
              Save this canvas as a template
            </button>
          )}
          <button type="button" className="dz-button" onClick={onClose}>
            Close
          </button>
        </div>
        {message && <p className="dz-hint">{message}</p>}
        <div className="dz-templates__grid">
          {builtInTemplates(sections).map((t) => (
            <div key={t.id} className="dz-template">
              <Thumb design={t.design} data={data} />
              <strong>{t.name}</strong>
              <span className="dz-hint">{t.description}</span>
              {canEdit && (
                <button type="button" className="dz-button" onClick={() => use(t.design, t.name)}>
                  Use
                </button>
              )}
            </div>
          ))}
          {(saved ?? []).map((t) => (
            <div key={t.id} className="dz-template">
              <Thumb design={cleanDesign(t.design)} data={data} />
              <strong>{t.name}</strong>
              <span className="dz-hint">Saved by your newsroom</span>
              {canEdit && (
                <span style={{ display: 'flex', gap: 4 }}>
                  <button type="button" className="dz-button" onClick={() => use(t.design, t.name)}>
                    Use
                  </button>
                  <button type="button" className="dz-button" onClick={() => remove(t)}>
                    Delete
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
