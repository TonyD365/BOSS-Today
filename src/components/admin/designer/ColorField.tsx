'use client'

import React, { useState } from 'react'

import { isColor, NEWSPAPER_COLORS } from '@/design/color'
import type { Fill } from '@/design/types'

const RECENT_KEY = 'boss-designer-recent-colors'

const readRecent = (): string[] => {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter(isColor).slice(0, 8) : []
  } catch {
    return []
  }
}

const remember = (color: string) => {
  try {
    const next = [color, ...readRecent().filter((c) => c !== color)].slice(0, 8)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // Private browsing: no recent colours.
  }
}

/** Any colour: a picker, a hex box, the newspaper's colours and recent ones. */
export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (color: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(value)
  const [recent, setRecent] = useState<string[]>([])
  const choose = (color: string) => {
    if (!isColor(color)) return
    remember(color)
    setText(color)
    onChange(color)
  }
  return (
    <div className="dz-color">
      <span className="dz-label">{label}</span>
      <button
        type="button"
        className="dz-swatch"
        style={{ background: value }}
        aria-label={`${label}: ${value}. Change`}
        onClick={() => {
          setRecent(readRecent())
          setText(value)
          setOpen(!open)
        }}
      />
      {open && (
        <div className="dz-popover" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
          <div className="dz-row">
            <input
              type="color"
              value={value.slice(0, 7)}
              onChange={(e) => choose(e.target.value)}
              aria-label="Pick any colour"
            />
            <input
              className="dz-input"
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                if (isColor(e.target.value)) choose(e.target.value.toLowerCase())
              }}
              aria-label="Hex colour"
              spellCheck={false}
            />
          </div>
          <span className="dz-hint">Newspaper colours</span>
          <div className="dz-swatches">
            {NEWSPAPER_COLORS.map((c) => (
              <button
                key={c.color}
                type="button"
                className="dz-swatch dz-swatch--small"
                style={{ background: c.color }}
                title={c.name}
                aria-label={c.name}
                onClick={() => choose(c.color)}
              />
            ))}
          </div>
          {recent.length > 0 && (
            <>
              <span className="dz-hint">Recent</span>
              <div className="dz-swatches">
                {recent.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="dz-swatch dz-swatch--small"
                    style={{ background: c }}
                    title={c}
                    aria-label={c}
                    onClick={() => choose(c)}
                  />
                ))}
              </div>
            </>
          )}
          <button type="button" className="dz-link" onClick={() => setOpen(false)}>
            Done
          </button>
        </div>
      )}
    </div>
  )
}

/** Solid colour, linear gradient or nothing. */
export function FillField({
  label,
  value,
  onChange,
  allowNone = true,
}: {
  label: string
  value: Fill
  onChange: (fill: Fill) => void
  allowNone?: boolean
}) {
  const kinds = allowNone ? (['solid', 'linear', 'none'] as const) : (['solid', 'linear'] as const)
  return (
    <div className="dz-group">
      <div className="dz-row">
        <span className="dz-label">{label}</span>
        <select
          className="dz-input"
          value={value.type}
          onChange={(e) => {
            const type = e.target.value as Fill['type']
            const base =
              value.type === 'solid'
                ? value.color
                : value.type === 'linear'
                  ? value.stops[0].color
                  : '#f6f1e7'
            onChange(
              type === 'solid'
                ? { type, color: base }
                : type === 'linear'
                  ? {
                      type,
                      angle: 90,
                      stops: [
                        { color: base, at: 0 },
                        { color: '#ffffff', at: 1 },
                      ],
                    }
                  : { type: 'none' },
            )
          }}
        >
          {kinds.map((k) => (
            <option key={k} value={k}>
              {k === 'solid' ? 'Colour' : k === 'linear' ? 'Gradient' : 'None'}
            </option>
          ))}
        </select>
      </div>
      {value.type === 'solid' && (
        <ColorField
          label="Colour"
          value={value.color}
          onChange={(color) => onChange({ type: 'solid', color })}
        />
      )}
      {value.type === 'linear' && (
        <>
          {value.stops.map((stop, i) => (
            <ColorField
              key={i}
              label={i === 0 ? 'From' : 'To'}
              value={stop.color}
              onChange={(color) =>
                onChange({
                  ...value,
                  stops: value.stops.map((s, j) => (j === i ? { ...s, color } : s)),
                })
              }
            />
          ))}
          <label className="dz-row">
            <span className="dz-label">Angle</span>
            <input
              type="range"
              min={0}
              max={360}
              value={value.angle}
              onChange={(e) => onChange({ ...value, angle: Number(e.target.value) })}
            />
            <span className="dz-value">{value.angle}°</span>
          </label>
        </>
      )}
    </div>
  )
}
