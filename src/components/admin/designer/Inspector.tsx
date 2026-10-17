'use client'

import React, { useEffect, useState } from 'react'

import { FONTS } from '@/design/fonts'
import type { DArticle, DImage } from '@/design/render'
import { NO_FILTERS } from '@/design/defaults'
import {
  type Design,
  type DesignElement,
  DESKTOP_WIDTH,
  type Geometry,
  IMAGE_MASKS,
  type ImageProps,
  SHAPES,
} from '@/design/types'

import { ColorField, FillField } from './ColorField'
import { SITE_PART_NAMES } from './names'
import type { View } from './operations'

export type InspectorContext = {
  sections: { id: number; name: string }[]
  stories: DArticle[]
  media: Record<number, DImage>
  onMedia: (id: number, image: DImage) => void
}

function Num({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
}) {
  return (
    <label className="dz-num">
      <span className="dz-label">{label}</span>
      <input
        className="dz-input"
        type="number"
        value={Math.round(value * 100) / 100}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (Number.isFinite(v))
            onChange(
              min !== undefined ? Math.max(min, max !== undefined ? Math.min(max, v) : v) : v,
            )
        }}
      />
      {suffix && <span className="dz-value">{suffix}</span>}
    </label>
  )
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="dz-toggle">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

function Choice<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <label className="dz-row">
      <span className="dz-label">{label}</span>
      <select
        className="dz-input"
        value={String(value)}
        onChange={(e) => {
          const found = options.find((o) => String(o.value) === e.target.value)
          if (found) onChange(found.value)
        }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

const PRESETS: { label: string; filters: ImageProps['filters'] }[] = [
  { label: 'Original', filters: { ...NO_FILTERS } },
  { label: 'B&W', filters: { ...NO_FILTERS, grayscale: 100, contrast: 110 } },
  { label: 'Vintage', filters: { ...NO_FILTERS, sepia: 45, contrast: 90, saturate: 80 } },
  { label: 'Vivid', filters: { ...NO_FILTERS, saturate: 140, contrast: 110 } },
  { label: 'Soft', filters: { ...NO_FILTERS, brightness: 108, contrast: 88, saturate: 90 } },
  { label: 'Dark', filters: { ...NO_FILTERS, brightness: 70 } },
]

/** Crop, shape, filters and frame for one image. */
function ImageTools({
  props,
  set,
  onBackground,
}: {
  props: ImageProps
  set: (change: Record<string, unknown>) => void
  onBackground: () => void
}) {
  const f = props.filters
  const filter = (change: Partial<ImageProps['filters']>) => set({ filters: { ...f, ...change } })
  const crop = (change: Partial<ImageProps['crop']>) => set({ crop: { ...props.crop, ...change } })
  const pct = (v: number) => `${Math.round(v)}%`
  return (
    <>
      <h4>Crop</h4>
      <Slider
        label="Zoom"
        value={props.crop.zoom}
        min={1}
        max={5}
        step={0.05}
        format={(v) => `${v.toFixed(2)}×`}
        onChange={(zoom) => crop({ zoom })}
      />
      <Slider
        label="Left ↔ right"
        value={props.crop.x}
        min={0}
        max={100}
        format={pct}
        onChange={(x) => crop({ x })}
      />
      <Slider
        label="Up ↕ down"
        value={props.crop.y}
        min={0}
        max={100}
        format={pct}
        onChange={(y) => crop({ y })}
      />
      <Choice
        label="Shape"
        value={props.mask}
        options={IMAGE_MASKS.map((mask) => ({
          value: mask,
          label: mask === 'none' ? 'Rectangle' : mask[0].toUpperCase() + mask.slice(1),
        }))}
        onChange={(mask) => set({ mask })}
      />
      <h4>Filters</h4>
      <div className="dz-presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className="dz-button"
            onClick={() => set({ filters: preset.filters })}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <Slider
        label="Brightness"
        value={f.brightness}
        min={0}
        max={200}
        format={pct}
        onChange={(brightness) => filter({ brightness })}
      />
      <Slider
        label="Contrast"
        value={f.contrast}
        min={0}
        max={200}
        format={pct}
        onChange={(contrast) => filter({ contrast })}
      />
      <Slider
        label="Saturation"
        value={f.saturate}
        min={0}
        max={200}
        format={pct}
        onChange={(saturate) => filter({ saturate })}
      />
      <Slider
        label="Black & white"
        value={f.grayscale}
        min={0}
        max={100}
        format={pct}
        onChange={(grayscale) => filter({ grayscale })}
      />
      <Slider
        label="Warmth (sepia)"
        value={f.sepia}
        min={0}
        max={100}
        format={pct}
        onChange={(sepia) => filter({ sepia })}
      />
      <Slider label="Blur" value={f.blur} min={0} max={40} onChange={(blur) => filter({ blur })} />
      <h4>Frame</h4>
      <Toggle label="Shadow" value={props.shadow} onChange={(shadow) => set({ shadow })} />
      <Toggle
        label="Border"
        value={Boolean(props.border)}
        onChange={(on) => set({ border: on ? { color: '#121212', width: 2 } : null })}
      />
      {props.border && (
        <>
          <ColorField
            label="Border colour"
            value={props.border.color}
            onChange={(color) => set({ border: { ...props.border!, color } })}
          />
          <Num
            label="Border width"
            value={props.border.width}
            min={1}
            max={40}
            onChange={(width) => set({ border: { ...props.border!, width } })}
          />
        </>
      )}
      <button
        type="button"
        className="dz-button"
        onClick={onBackground}
        title="Fill the page with this image, behind everything, and lock it"
      >
        Set as background
      </button>
    </>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format = (v: number) => String(v),
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  return (
    <label className="dz-row">
      <span className="dz-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="dz-value">{format(value)}</span>
    </label>
  )
}

const fontOptions = FONTS.map((f) => ({ value: f.id, label: f.label }))

/** Chooses an image from the media library, or uploads one. */
function ImagePicker({
  value,
  ctx,
  onPick,
}: {
  value: number | null
  ctx: InspectorContext
  onPick: (id: number) => void
}) {
  const [items, setItems] = useState<{ id: number; image: DImage }[]>([])
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ limit: '30', sort: '-createdAt', depth: '0' })
    if (query) params.set('where[alt][like]', query)
    fetch(`/api/media?${params}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { docs: [] }))
      .then(
        (body: {
          docs: { id: number; url: string; alt: string; sizes?: { thumb?: { url?: string } } }[]
        }) => {
          if (cancelled) return
          setItems(
            body.docs.map((m) => ({
              id: m.id,
              image: { url: m.sizes?.thumb?.url ?? m.url, alt: m.alt },
            })),
          )
        },
      )
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [query])

  const upload = async (file: File) => {
    const alt = window.prompt('Describe the image for readers who can’t see it (alt text):', '')
    if (!alt?.trim()) return
    setBusy(true)
    setError(null)
    const form = new FormData()
    form.append('file', file)
    form.append('_payload', JSON.stringify({ alt: alt.trim() }))
    const response = await fetch('/api/media', {
      method: 'POST',
      credentials: 'include',
      body: form,
    })
    const result = (await response.json().catch(() => ({}))) as {
      doc?: { id: number; url: string; alt: string; sizes?: { card?: { url?: string } } }
      errors?: { message?: string }[]
      message?: string
    }
    setBusy(false)
    if (!response.ok || !result.doc) {
      setError(result.errors?.[0]?.message ?? result.message ?? 'Upload failed.')
      return
    }
    ctx.onMedia(result.doc.id, {
      url: result.doc.sizes?.card?.url ?? result.doc.url,
      alt: result.doc.alt,
    })
    onPick(result.doc.id)
  }

  return (
    <div className="dz-group">
      <input
        className="dz-input"
        placeholder="Search images"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="dz-thumbs">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`dz-thumb${item.id === value ? ' dz-thumb--on' : ''}`}
            onClick={() => {
              ctx.onMedia(item.id, item.image)
              onPick(item.id)
            }}
            title={item.image.alt}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.image.url} alt={item.image.alt} />
          </button>
        ))}
      </div>
      <label className="dz-upload">
        {busy ? 'Uploading…' : 'Upload an image'}
        <input
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          hidden
        />
      </label>
      {error && <p className="dz-error">{error}</p>}
    </div>
  )
}

/** Settings for the selected element(s), or the page when nothing is selected. */
export function Inspector({
  design,
  view,
  selected,
  geometry,
  ctx,
  readOnly,
  onProps,
  onElement,
  onGeometry,
  onDesign,
  onMarkPhoneChecked,
  onResetPhone,
}: {
  design: Design
  view: View
  selected: DesignElement[]
  geometry: Map<string, Geometry>
  ctx: InspectorContext
  readOnly: boolean
  onProps: (ids: string[], props: Record<string, unknown>) => void
  onElement: (ids: string[], change: Partial<DesignElement>) => void
  onGeometry: (id: string, change: Partial<Geometry>) => void
  onDesign: (change: (d: Design) => Design) => void
  onMarkPhoneChecked: () => void
  onResetPhone: () => void
}) {
  if (selected.length === 0) {
    const unchecked =
      design.desktopChangedAt &&
      (!design.phoneCheckedAt || design.phoneCheckedAt < design.desktopChangedAt)
    return (
      <fieldset className="dz-inspector" disabled={readOnly}>
        <h3>Page</h3>
        <FillField
          label="Background"
          value={design.desktop.background}
          allowNone={false}
          onChange={(background) =>
            onDesign((d) => ({ ...d, desktop: { ...d.desktop, background } }))
          }
        />
        {view === 'desktop' && (
          <Num
            label="Page height"
            value={design.desktop.height}
            min={200}
            max={20000}
            step={20}
            onChange={(height) => onDesign((d) => ({ ...d, desktop: { ...d.desktop, height } }))}
          />
        )}
        {view === 'phone' && (
          <div className="dz-group">
            <p className="dz-hint">
              Phones get their own layout. Anything you haven’t moved here is stacked automatically,
              top to bottom.
            </p>
            {unchecked && (
              <p className="dz-warn">
                The desktop layout changed since the phone layout was last checked.
              </p>
            )}
            <button type="button" className="dz-button" onClick={onMarkPhoneChecked}>
              I’ve checked the phone layout
            </button>
            <button type="button" className="dz-link" onClick={onResetPhone}>
              Reset the phone layout to automatic
            </button>
          </div>
        )}
        <p className="dz-hint">
          Click an element to change it. Double-click text to edit it. Right-click for more.
        </p>
      </fieldset>
    )
  }

  const ids = selected.map((el) => el.id)
  const first = selected[0]
  const same = selected.every((el) => el.type === first.type)
  const g = geometry.get(first.id)
  const p = first.props as Record<string, unknown>
  const set = (props: Record<string, unknown>) => onProps(ids, props)

  return (
    <fieldset className="dz-inspector" disabled={readOnly}>
      <h3>
        {selected.length > 1
          ? `${selected.length} elements`
          : first.name || first.type[0].toUpperCase() + first.type.slice(1)}
      </h3>

      {selected.length === 1 && g && (
        <div className="dz-grid2">
          <Num label="X" value={g.x} onChange={(x) => onGeometry(first.id, { x })} />
          <Num label="Y" value={g.y} onChange={(y) => onGeometry(first.id, { y })} />
          <Num label="W" value={g.w} min={1} onChange={(w) => onGeometry(first.id, { w })} />
          <Num label="H" value={g.h} min={1} onChange={(h) => onGeometry(first.id, { h })} />
          <Num
            label="Rotate"
            value={g.rotation}
            min={-180}
            max={180}
            suffix="°"
            onChange={(rotation) => onGeometry(first.id, { rotation })}
          />
          {view === 'phone' && g.fontScale !== undefined && (
            <Num
              label="Text size"
              value={Math.round((g.fontScale ?? 1) * 100)}
              min={20}
              max={200}
              suffix="%"
              onChange={(v) => onGeometry(first.id, { fontScale: v / 100 })}
            />
          )}
        </div>
      )}
      <Slider
        label="Transparency"
        value={Math.round((1 - first.opacity) * 100)}
        min={0}
        max={100}
        format={(v) => `${v}%`}
        onChange={(v) => onElement(ids, { opacity: 1 - v / 100 })}
      />
      <div className="dz-row">
        <button
          type="button"
          className="dz-button"
          onClick={() => onElement(ids, { flipX: !first.flipX })}
        >
          Flip ↔
        </button>
        <button
          type="button"
          className="dz-button"
          onClick={() => onElement(ids, { flipY: !first.flipY })}
        >
          Flip ↕
        </button>
      </div>
      {selected.length === 1 && (
        <label className="dz-row">
          <span className="dz-label">Name</span>
          <input
            className="dz-input"
            value={first.name ?? ''}
            placeholder={first.type}
            onChange={(e) => onElement(ids, { name: e.target.value.slice(0, 60) })}
          />
        </label>
      )}

      {same && first.type === 'text' && (
        <div className="dz-group">
          <h4>Text</h4>
          <Choice
            label="Font"
            value={p.font as string}
            options={fontOptions}
            onChange={(font) => set({ font })}
          />
          <Num
            label="Size"
            value={p.size as number}
            min={6}
            max={300}
            onChange={(size) => set({ size })}
          />
          <div className="dz-row">
            <button
              type="button"
              className={`dz-button${p.weight === 700 ? ' dz-on' : ''}`}
              onClick={() => set({ weight: p.weight === 700 ? 400 : 700 })}
            >
              <b>B</b> Bold
            </button>
            <Choice
              label=""
              value={p.align as string}
              options={[
                { value: 'left', label: 'Left' },
                { value: 'center', label: 'Centre' },
                { value: 'right', label: 'Right' },
                { value: 'justify', label: 'Justify' },
              ]}
              onChange={(align) => set({ align })}
            />
          </div>
          <ColorField
            label="Colour"
            value={p.color as string}
            onChange={(color) => set({ color })}
          />
          <Slider
            label="Line height"
            value={p.lineHeight as number}
            min={0.7}
            max={3}
            step={0.05}
            onChange={(lineHeight) => set({ lineHeight })}
          />
          <Slider
            label="Spacing"
            value={p.letterSpacing as number}
            min={-5}
            max={30}
            step={0.5}
            onChange={(letterSpacing) => set({ letterSpacing })}
          />
          <Choice
            label="Case"
            value={p.transform as string}
            options={[
              { value: 'none', label: 'As typed' },
              { value: 'uppercase', label: 'UPPERCASE' },
              { value: 'lowercase', label: 'lowercase' },
            ]}
            onChange={(transform) => set({ transform })}
          />
          <Toggle
            label="Box grows with text"
            value={p.autoHeight as boolean}
            onChange={(autoHeight) => set({ autoHeight })}
          />
          <h4>Effects</h4>
          <Toggle
            label="Shadow"
            value={Boolean(p.shadow)}
            onChange={(on) =>
              set({ shadow: on ? { x: 2, y: 2, blur: 6, color: '#00000066' } : null })
            }
          />
          {Boolean(p.shadow) && (
            <>
              <Slider
                label="Offset"
                value={(p.shadow as { x: number }).x}
                min={-30}
                max={30}
                onChange={(v) => set({ shadow: { ...(p.shadow as object), x: v, y: v } })}
              />
              <Slider
                label="Blur"
                value={(p.shadow as { blur: number }).blur}
                min={0}
                max={40}
                onChange={(blur) => set({ shadow: { ...(p.shadow as object), blur } })}
              />
              <ColorField
                label="Shadow colour"
                value={(p.shadow as { color: string }).color}
                onChange={(color) => set({ shadow: { ...(p.shadow as object), color } })}
              />
            </>
          )}
          <Toggle
            label="Outline"
            value={Boolean(p.outline)}
            onChange={(on) => set({ outline: on ? { width: 1, color: '#121212' } : null })}
          />
          {Boolean(p.outline) && (
            <>
              <Slider
                label="Thickness"
                value={(p.outline as { width: number }).width}
                min={0.5}
                max={10}
                step={0.5}
                onChange={(width) => set({ outline: { ...(p.outline as object), width } })}
              />
              <ColorField
                label="Outline colour"
                value={(p.outline as { color: string }).color}
                onChange={(color) => set({ outline: { ...(p.outline as object), color } })}
              />
            </>
          )}
          <Toggle
            label="Background"
            value={Boolean(p.background)}
            onChange={(on) =>
              set({ background: on ? { color: '#f6f1e7', padding: 8, radius: 4 } : null })
            }
          />
          {Boolean(p.background) && (
            <>
              <ColorField
                label="Background"
                value={(p.background as { color: string }).color}
                onChange={(color) => set({ background: { ...(p.background as object), color } })}
              />
              <Slider
                label="Padding"
                value={(p.background as { padding: number }).padding}
                min={0}
                max={60}
                onChange={(padding) =>
                  set({ background: { ...(p.background as object), padding } })
                }
              />
              <Slider
                label="Roundness"
                value={(p.background as { radius: number }).radius}
                min={0}
                max={60}
                onChange={(radius) => set({ background: { ...(p.background as object), radius } })}
              />
            </>
          )}
          <Slider
            label="Curve"
            value={p.curve as number}
            min={-100}
            max={100}
            onChange={(curve) => set({ curve })}
          />
          {(p.curve as number) !== 0 && <p className="dz-hint">Curved text shows one line.</p>}
        </div>
      )}

      {same && first.type === 'shape' && (
        <div className="dz-group">
          <h4>Shape</h4>
          <Choice
            label="Shape"
            value={p.kind as string}
            options={SHAPES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))}
            onChange={(kind) => set({ kind })}
          />
          {p.kind !== 'line' && (
            <FillField label="Fill" value={p.fill as never} onChange={(fill) => set({ fill })} />
          )}
          <Toggle
            label={p.kind === 'line' ? 'Line' : 'Border'}
            value={Boolean(p.stroke)}
            onChange={(on) =>
              set({ stroke: on ? { color: '#121212', width: 2, dash: 'solid' } : null })
            }
          />
          {Boolean(p.stroke) && (
            <>
              <ColorField
                label="Colour"
                value={(p.stroke as { color: string }).color}
                onChange={(color) => set({ stroke: { ...(p.stroke as object), color } })}
              />
              <Slider
                label="Thickness"
                value={(p.stroke as { width: number }).width}
                min={0.5}
                max={40}
                step={0.5}
                onChange={(width) => set({ stroke: { ...(p.stroke as object), width } })}
              />
              <Choice
                label="Style"
                value={(p.stroke as { dash: string }).dash}
                options={[
                  { value: 'solid', label: 'Solid' },
                  { value: 'dashed', label: 'Dashed' },
                  { value: 'dotted', label: 'Dotted' },
                ]}
                onChange={(dash) => set({ stroke: { ...(p.stroke as object), dash } })}
              />
            </>
          )}
          {(p.kind === 'rect' || p.kind === 'bubble') && (
            <Slider
              label="Roundness"
              value={p.radius as number}
              min={0}
              max={300}
              onChange={(radius) => set({ radius })}
            />
          )}
          {(p.kind === 'star' || p.kind === 'polygon') && (
            <Slider
              label={p.kind === 'star' ? 'Points' : 'Sides'}
              value={p.points as number}
              min={3}
              max={12}
              onChange={(points) => set({ points })}
            />
          )}
          {p.kind === 'line' && (
            <div className="dz-row">
              <Toggle
                label="Arrow at start"
                value={p.arrowStart as boolean}
                onChange={(arrowStart) => set({ arrowStart })}
              />
              <Toggle
                label="Arrow at end"
                value={p.arrowEnd as boolean}
                onChange={(arrowEnd) => set({ arrowEnd })}
              />
            </div>
          )}
        </div>
      )}

      {selected.length === 1 && first.type === 'image' && (
        <div className="dz-group">
          <h4>Image</h4>
          <ImagePicker
            value={p.mediaId as number | null}
            ctx={ctx}
            onPick={(mediaId) => set({ mediaId })}
          />
          <Choice
            label="Fit"
            value={p.fit as string}
            options={[
              { value: 'cover', label: 'Fill the box' },
              { value: 'contain', label: 'Show it all' },
            ]}
            onChange={(fit) => set({ fit })}
          />
          <Slider
            label="Roundness"
            value={p.radius as number}
            min={0}
            max={300}
            onChange={(radius) => set({ radius })}
          />
          <label className="dz-row">
            <span className="dz-label">Link</span>
            <input
              className="dz-input"
              value={(p.link as string | null) ?? ''}
              placeholder="https://… or /article/…"
              onChange={(e) =>
                set({ link: /^(https?:\/\/|\/)/.test(e.target.value) ? e.target.value : null })
              }
            />
          </label>
          <ImageTools
            props={first.props}
            set={set}
            onBackground={() =>
              onDesign((d) => {
                const el = d.desktop.elements.find((x) => x.id === first.id)
                if (!el) return d
                const others = d.desktop.elements.filter((x) => x.id !== first.id)
                const background = {
                  ...el,
                  x: 0,
                  y: 0,
                  w: d.desktop.width ?? DESKTOP_WIDTH,
                  h: d.desktop.height,
                  rotation: 0,
                  locked: true,
                }
                return { ...d, desktop: { ...d.desktop, elements: [background, ...others] } }
              })
            }
          />
        </div>
      )}

      {same && first.type === 'story' && (
        <div className="dz-group">
          <h4>Story</h4>
          <Choice
            label="Shows"
            value={p.source as string}
            options={[
              { value: 'latest', label: 'Newest story' },
              { value: 'section', label: 'Newest in a section' },
              { value: 'pick', label: 'A story I choose' },
            ]}
            onChange={(source) => set({ source })}
          />
          {p.source === 'pick' ? (
            <Choice
              label="Story"
              value={(p.articleId as number | null) ?? 0}
              options={[
                { value: 0, label: 'Choose…' },
                ...ctx.stories.map((s) => ({ value: s.id, label: s.title })),
              ]}
              onChange={(articleId) => set({ articleId: articleId || null })}
            />
          ) : (
            <>
              {p.source === 'section' && (
                <Choice
                  label="Section"
                  value={(p.sectionId as number | null) ?? 0}
                  options={[
                    { value: 0, label: 'Choose…' },
                    ...ctx.sections.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                  onChange={(sectionId) => set({ sectionId: sectionId || null })}
                />
              )}
              <Num
                label="Number"
                value={p.index as number}
                min={1}
                max={50}
                onChange={(index) => set({ index })}
              />
              <p className="dz-hint">
                1 is the newest, 2 the one before, and so on. Changes by itself as stories are
                published.
              </p>
            </>
          )}
          <Toggle
            label="Picture"
            value={p.showImage as boolean}
            onChange={(showImage) => set({ showImage })}
          />
          {Boolean(p.showImage) && (
            <Choice
              label="Picture"
              value={p.imagePosition as string}
              options={[
                { value: 'top', label: 'Above' },
                { value: 'left', label: 'Left' },
                { value: 'right', label: 'Right' },
              ]}
              onChange={(imagePosition) => set({ imagePosition })}
            />
          )}
          <Toggle
            label="Section label"
            value={p.showKicker as boolean}
            onChange={(showKicker) => set({ showKicker })}
          />
          <Toggle
            label="Summary"
            value={p.showSummary as boolean}
            onChange={(showSummary) => set({ showSummary })}
          />
          <Toggle
            label="Byline"
            value={p.showByline as boolean}
            onChange={(showByline) => set({ showByline })}
          />
          <Num
            label="Headline size"
            value={p.headlineSize as number}
            min={10}
            max={120}
            onChange={(headlineSize) => set({ headlineSize })}
          />
          <Choice
            label="Font"
            value={p.font as string}
            options={fontOptions}
            onChange={(font) => set({ font })}
          />
          <ColorField
            label="Text colour"
            value={p.color as string}
            onChange={(color) => set({ color })}
          />
        </div>
      )}

      {same && first.type === 'list' && (
        <div className="dz-group">
          <h4>List</h4>
          <Choice
            label="Shows"
            value={p.kind as string}
            options={[
              { value: 'latest', label: 'Latest stories' },
              { value: 'mostread', label: 'Most read this week' },
              { value: 'section', label: 'A section' },
            ]}
            onChange={(kind) => set({ kind })}
          />
          {p.kind === 'section' && (
            <Choice
              label="Section"
              value={(p.sectionId as number | null) ?? 0}
              options={[
                { value: 0, label: 'Choose…' },
                ...ctx.sections.map((s) => ({ value: s.id, label: s.name })),
              ]}
              onChange={(sectionId) => set({ sectionId: sectionId || null })}
            />
          )}
          <label className="dz-row">
            <span className="dz-label">Title</span>
            <input
              className="dz-input"
              value={p.title as string}
              onChange={(e) => set({ title: e.target.value.slice(0, 80) })}
            />
          </label>
          <Num
            label="How many"
            value={p.count as number}
            min={1}
            max={12}
            onChange={(count) => set({ count })}
          />
          {p.kind !== 'mostread' && (
            <Toggle
              label="Pictures"
              value={p.showImage as boolean}
              onChange={(showImage) => set({ showImage })}
            />
          )}
          <Choice
            label="Font"
            value={p.font as string}
            options={fontOptions}
            onChange={(font) => set({ font })}
          />
          <ColorField
            label="Text colour"
            value={p.color as string}
            onChange={(color) => set({ color })}
          />
        </div>
      )}

      {same && first.type === 'widget' && (
        <div className="dz-group">
          <h4>Box</h4>
          <Choice
            label="Shows"
            value={p.kind as string}
            options={[
              { value: 'scores', label: 'Scores' },
              { value: 'events', label: 'This week’s events' },
              { value: 'live', label: 'LIVE link' },
              { value: 'issue', label: 'Latest issue' },
            ]}
            onChange={(kind) => set({ kind })}
          />
          {p.kind !== 'live' && (
            <label className="dz-row">
              <span className="dz-label">Title</span>
              <input
                className="dz-input"
                value={p.title as string}
                onChange={(e) => set({ title: e.target.value.slice(0, 80) })}
              />
            </label>
          )}
          {(p.kind === 'scores' || p.kind === 'events') && (
            <Num
              label="How many"
              value={p.count as number}
              min={1}
              max={12}
              onChange={(count) => set({ count })}
            />
          )}
          <ColorField
            label="Text colour"
            value={p.color as string}
            onChange={(color) => set({ color })}
          />
          {p.kind === 'live' && (
            <p className="dz-hint">
              Only appears on the website while something is being covered live.
            </p>
          )}
        </div>
      )}
      {selected.length === 1 && first.type === 'table' && (
        <div className="dz-group">
          <h4>Table</h4>
          <label className="dz-row dz-row--stack">
            <span className="dz-label">
              Cells: one row per line, columns split by | (or paste from a spreadsheet)
            </span>
            <textarea
              key={first.id}
              className="dz-input dz-table-text"
              rows={Math.min(12, first.props.rows.length + 2)}
              defaultValue={first.props.rows.map((row) => row.join(' | ')).join('\n')}
              onBlur={(e) =>
                set({
                  rows: e.target.value
                    .split('\n')
                    .filter((line) => line.trim())
                    .map((line) =>
                      line.split(line.includes('\t') ? '\t' : '|').map((c) => c.trim()),
                    ),
                })
              }
            />
          </label>
          <Toggle
            label="First row is a header"
            value={first.props.header}
            onChange={(header) => set({ header })}
          />
          <Toggle
            label="Shaded rows"
            value={first.props.stripes}
            onChange={(stripes) => set({ stripes })}
          />
          <Choice
            label="Font"
            value={first.props.font}
            options={fontOptions}
            onChange={(font) => set({ font })}
          />
          <Num
            label="Size"
            value={first.props.size}
            min={8}
            max={60}
            onChange={(size) => set({ size })}
          />
          <Choice
            label="Align"
            value={first.props.align}
            options={[
              { value: 'left', label: 'Left' },
              { value: 'center', label: 'Centre' },
            ]}
            onChange={(align) => set({ align })}
          />
          <ColorField label="Text" value={first.props.color} onChange={(color) => set({ color })} />
          <ColorField
            label="Header"
            value={first.props.headerFill}
            onChange={(headerFill) => set({ headerFill })}
          />
          <ColorField
            label="Header text"
            value={first.props.headerColor}
            onChange={(headerColor) => set({ headerColor })}
          />
          <ColorField
            label="Lines"
            value={first.props.lines}
            onChange={(lines) => set({ lines })}
          />
        </div>
      )}

      {same && first.type === 'icon' && (
        <div className="dz-group">
          <h4>Icon</h4>
          <ColorField
            label="Colour"
            value={p.color as string}
            onChange={(color) => set({ color })}
          />
          <Slider
            label="Line width"
            value={p.strokeWidth as number}
            min={0.5}
            max={4}
            step={0.25}
            onChange={(strokeWidth) => set({ strokeWidth })}
          />
        </div>
      )}

      {same && first.type === 'site' && (
        <div className="dz-group">
          <h4>{SITE_PART_NAMES[first.props.kind]}</h4>
          <p className="dz-hint">
            {
              {
                nav: 'The sections, Issues, and pages chosen for the navigation. A menu button on phones. It can be restyled and moved, but the header must keep it.',
                search: 'Searches every story.',
                date: 'Today’s date, filled in when a reader opens the page.',
                theme: 'Lets readers switch between light and dark.',
                sitename: 'The paper’s name (from Site settings), linking home.',
                staff: 'Where staff sign in. The header or footer must keep it.',
                links:
                  'About, pages chosen for the footer, Topics, Scores, Calendar, Our Staff, Contact, RSS, social links, and Staff sign-in.',
                tagline: 'The tagline and footer note from Site settings.',
              }[first.props.kind]
            }
          </p>
          <Choice
            label="Font"
            value={p.font as string}
            options={fontOptions}
            onChange={(font) => set({ font })}
          />
          <Num
            label="Size"
            value={p.size as number}
            min={8}
            max={200}
            onChange={(size) => set({ size })}
          />
          {first.props.kind !== 'search' && (
            <>
              <Choice
                label="Weight"
                value={p.weight as number}
                options={[
                  { value: 400, label: 'Regular' },
                  { value: 700, label: 'Bold' },
                ]}
                onChange={(weight) => set({ weight })}
              />
              <Choice
                label="Align"
                value={p.align as string}
                options={[
                  { value: 'left', label: 'Left' },
                  { value: 'center', label: 'Centre' },
                  { value: 'right', label: 'Right' },
                ]}
                onChange={(align) => set({ align })}
              />
              <Toggle
                label="Capitals"
                value={p.uppercase as boolean}
                onChange={(uppercase) => set({ uppercase })}
              />
              <ColorField
                label="Colour"
                value={p.color as string}
                onChange={(color) => set({ color })}
              />
            </>
          )}
          {(first.props.kind === 'nav' || first.props.kind === 'links') && (
            <Num
              label="Space between"
              value={p.gap as number}
              min={0}
              max={120}
              onChange={(gap) => set({ gap })}
            />
          )}
        </div>
      )}
    </fieldset>
  )
}
