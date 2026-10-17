'use client'

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { fontFamily } from '@/design/fonts'
import { boxStyle, canvasSize, DesignCanvas, type DesignData } from '@/design/render'
import type { Design, DesignElement, Geometry } from '@/design/types'

import {
  angleTo,
  bounds,
  type Box,
  center,
  type Guide,
  HANDLES,
  type Handle,
  handleSigns,
  intersects,
  normalizeAngle,
  type Point,
  resizeBox,
  rotate,
  snapAngle,
  snapMove,
  snapToGrid,
  union,
} from './geometry'
import { expandGroups, geometryMap, setGeometry, updateElements, type View } from './operations'
import { htmlToParagraphs, paragraphsToHtml } from './textEditing'

type Drag =
  | { mode: 'move'; start: Point; design: Design; ids: string[]; moved: boolean }
  | { mode: 'resize'; start: Point; design: Design; ids: string[]; handle: Handle; box: Box }
  | {
      mode: 'rotate'
      start: Point
      design: Design
      ids: string[]
      origin: Point
      startAngle: number
    }
  | { mode: 'marquee'; start: Point; additive: string[] }

export function Stage({
  design,
  view,
  data,
  zoom,
  selection,
  onSelect,
  onPreview,
  onCommit,
  onAdjust,
  editingId,
  onEditText,
  onContextMenu,
  readOnly,
  showGrid,
  rulers,
  overflow,
  onOverflow,
}: {
  design: Design
  view: View
  data: DesignData
  zoom: number
  selection: string[]
  onSelect: (ids: string[]) => void
  /** While dragging: show, but don't add to history yet. */
  onPreview: (design: Design) => void
  /** Finished: add to history (from the design before the drag). */
  onCommit: (design: Design, before: Design) => void
  /** Automatic fixes (text box heights) that aren't user actions. */
  onAdjust: (design: Design) => void
  editingId: string | null
  onEditText: (id: string | null) => void
  onContextMenu: (at: { x: number; y: number }, id: string | null) => void
  readOnly: boolean
  showGrid: boolean
  /** Rulers along the canvas, for dragging out guide lines (desktop only). */
  rulers: boolean
  overflow: Set<string>
  onOverflow: (ids: Set<string>) => void
}) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const [guides, setGuides] = useState<Guide[]>([])
  const [marquee, setMarquee] = useState<Box | null>(null)
  const size = canvasSize(design, view)
  const geometry = geometryMap(design, view)
  const byId = new Map(design.desktop.elements.map((el) => [el.id, el]))

  const toCanvas = useCallback(
    (event: { clientX: number; clientY: number }): Point => {
      const rect = canvasRef.current!.getBoundingClientRect()
      return { x: (event.clientX - rect.left) / zoom, y: (event.clientY - rect.top) / zoom }
    },
    [zoom],
  )

  // Text boxes grow and shrink with their text; anything that still doesn't fit is marked.
  useLayoutEffect(() => {
    const root = canvasRef.current
    if (!root) return
    const heights: Record<string, Partial<Geometry>> = {}
    const over = new Set<string>()
    for (const el of design.desktop.elements) {
      const box = root.querySelector<HTMLElement>(`[data-id="${el.id}"]`)
      if (!box) continue
      const g = geometry.get(el.id)
      if (
        el.type === 'text' &&
        el.props.autoHeight &&
        el.props.curve === 0 &&
        view === 'desktop' &&
        editingId !== el.id
      ) {
        const inner = box.querySelector<HTMLElement>('.dc-text')
        if (inner) {
          const prev = inner.style.height
          inner.style.height = 'auto'
          const needed = Math.ceil(inner.scrollHeight / zoom)
          inner.style.height = prev
          if (g && Math.abs(needed - g.h) > 1) heights[el.id] = { h: needed }
        }
      }
      const content = box.querySelector<HTMLElement>(
        '.dc-story__text, .dc-list, .dc-widget, .dc-text',
      )
      if (content && content.scrollHeight > content.clientHeight + 3) over.add(el.id)
    }
    if (Object.keys(heights).length > 0 && !drag.current)
      onAdjust(setGeometry(design, view, heights))
    const changed = over.size !== overflow.size || [...over].some((id) => !overflow.has(id))
    if (changed) onOverflow(over)
  })

  const selectable = (ids: string[]) => ids.filter((id) => !byId.get(id)?.locked)

  const startMove = (event: React.PointerEvent, el: DesignElement) => {
    if (event.button !== 0 || editingId === el.id) return
    event.stopPropagation()
    const ids = expandGroups(design, [el.id])
    let next = selection
    if (event.shiftKey) {
      next = ids.every((id) => selection.includes(id))
        ? selection.filter((id) => !ids.includes(id))
        : [...selection, ...ids]
    } else if (!selection.includes(el.id)) next = ids
    onSelect(next)
    if (readOnly || el.locked) return
    const moving = selectable(next)
    if (moving.length === 0) return
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
    drag.current = { mode: 'move', start: toCanvas(event), design, ids: moving, moved: false }
  }

  const startHandle = (event: React.PointerEvent, handle: Handle | 'rotate', box: Box) => {
    event.stopPropagation()
    if (readOnly) return
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
    const ids = selectable(selection)
    const start = toCanvas(event)
    if (handle === 'rotate') {
      const origin = ids.length === 1 ? center(geometry.get(ids[0])!) : center(box)
      drag.current = {
        mode: 'rotate',
        start,
        design,
        ids,
        origin,
        startAngle: angleTo(origin, start),
      }
    } else {
      drag.current = { mode: 'resize', start, design, ids, handle, box }
    }
  }

  const startBackground = (event: React.PointerEvent) => {
    if (event.button !== 0) return
    if (editingId) onEditText(null)
    const start = toCanvas(event)
    const additive = event.shiftKey ? selection : []
    if (!event.shiftKey) onSelect([])
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
    drag.current = { mode: 'marquee', start, additive }
  }

  const onPointerMove = (event: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const p = toCanvas(event)
    if (d.mode === 'marquee') {
      const box = {
        x: Math.min(d.start.x, p.x),
        y: Math.min(d.start.y, p.y),
        w: Math.abs(p.x - d.start.x),
        h: Math.abs(p.y - d.start.y),
      }
      setMarquee(box)
      const hit = design.desktop.elements
        .filter((el) => {
          const g = geometry.get(el.id)
          return g && !g.hidden && !el.hidden && intersects(bounds(g), box)
        })
        .map((el) => el.id)
      onSelect([...new Set([...d.additive, ...expandGroups(design, hit)])])
      return
    }
    const startGeo = geometryMap(d.design, view)
    if (d.mode === 'move') {
      let dx = p.x - d.start.x
      let dy = p.y - d.start.y
      if (!d.moved && Math.hypot(dx, dy) * zoom < 3) return
      d.moved = true
      if (event.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0
        else dx = 0
      }
      const moving = union(d.ids.map((id) => bounds(startGeo.get(id)!)))!
      const others = design.desktop.elements
        .filter((el) => !d.ids.includes(el.id) && !el.hidden && !startGeo.get(el.id)?.hidden)
        .map((el) => bounds(startGeo.get(el.id)!))
      const shifted = { ...moving, x: moving.x + dx, y: moving.y + dy }
      const snap = event.altKey
        ? { dx: 0, dy: 0, guides: [] }
        : snapMove(
            shifted,
            others,
            { w: size.width, h: size.height },
            6 / zoom,
            view === 'desktop' ? design.guides : undefined,
          )
      if (snap.guides.length === 0 && showGrid && !event.altKey) {
        snap.dx = snapToGrid(shifted.x, 10) - shifted.x
        snap.dy = snapToGrid(shifted.y, 10) - shifted.y
      }
      setGuides(snap.guides)
      const changes: Record<string, Partial<Geometry>> = {}
      for (const id of d.ids) {
        const g = startGeo.get(id)!
        changes[id] = { x: Math.round(g.x + dx + snap.dx), y: Math.round(g.y + dy + snap.dy) }
      }
      onPreview(setGeometry(d.design, view, changes))
      return
    }
    if (d.mode === 'rotate') {
      const delta = angleTo(d.origin, p) - d.startAngle
      const changes: Record<string, Partial<Geometry>> = {}
      for (const id of d.ids) {
        const g = startGeo.get(id)!
        const angle = normalizeAngle(snapAngle(normalizeAngle(g.rotation + delta), event.shiftKey))
        if (d.ids.length === 1) changes[id] = { rotation: angle }
        else {
          const c = center(g)
          const moved = rotate({ x: c.x - d.origin.x, y: c.y - d.origin.y }, angle - g.rotation)
          changes[id] = {
            rotation: angle,
            x: d.origin.x + moved.x - g.w / 2,
            y: d.origin.y + moved.y - g.h / 2,
          }
        }
      }
      onPreview(setGeometry(d.design, view, changes))
      return
    }
    // Resize.
    if (d.ids.length === 1) {
      const id = d.ids[0]
      const el = d.design.desktop.elements.find((e) => e.id === id)!
      const g = startGeo.get(id)!
      const s = handleSigns(d.handle)
      const corner = s.x !== 0 && s.y !== 0
      const keep = event.shiftKey || (corner && (el.type === 'image' || el.type === 'text'))
      const next = resizeBox(g, d.handle, p, keep)
      let result = setGeometry(d.design, view, {
        [id]: {
          x: Math.round(next.x),
          y: Math.round(next.y),
          w: Math.round(next.w),
          h: Math.round(next.h),
        },
      })
      // Dragging a text box's corner scales its text, like Canva.
      if (el.type === 'text' && corner && view === 'desktop') {
        const k = next.w / g.w
        result = updateElements(result, [id], (e) =>
          e.type === 'text'
            ? {
                ...e,
                props: {
                  ...e.props,
                  size: Math.round(e.props.size * k * 10) / 10,
                  paragraphs: e.props.paragraphs.map((para) => ({
                    ...para,
                    runs: para.runs.map((run) =>
                      run.size ? { ...run, size: Math.round(run.size * k * 10) / 10 } : run,
                    ),
                  })),
                },
              }
            : e,
        )
      }
      onPreview(result)
      return
    }
    // Several elements scale together inside their shared box.
    const box = d.box
    const next = resizeBox(
      { ...box, rotation: 0, hidden: false },
      d.handle,
      p,
      event.shiftKey || true,
    )
    const kx = next.w / box.w
    const ky = next.h / box.h
    const changes: Record<string, Partial<Geometry>> = {}
    for (const id of d.ids) {
      const g = startGeo.get(id)!
      changes[id] = {
        x: Math.round(next.x + (g.x - box.x) * kx),
        y: Math.round(next.y + (g.y - box.y) * ky),
        w: Math.max(4, Math.round(g.w * kx)),
        h: Math.max(4, Math.round(g.h * ky)),
      }
    }
    onPreview(setGeometry(d.design, view, changes))
  }

  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    setGuides([])
    setMarquee(null)
    if (!d || d.mode === 'marquee') return
    if (d.mode === 'move' && !d.moved) return
    onCommit(design, d.design)
  }

  // Inline text editing.
  const editorRef = useRef<HTMLDivElement>(null)
  const editing = editingId ? byId.get(editingId) : undefined
  useEffect(() => {
    const box = editorRef.current
    if (!box || !editing || editing.type !== 'text') return
    box.innerHTML = paragraphsToHtml(editing.props.paragraphs, zoom)
    box.focus()
    const range = document.createRange()
    range.selectNodeContents(box)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    // Only when editing starts; typing must not reset the box.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId])

  const finishEditing = () => {
    const box = editorRef.current
    if (!box || !editing || editing.type !== 'text') return
    const paragraphs = htmlToParagraphs(box, zoom)
    if (JSON.stringify(paragraphs) !== JSON.stringify(editing.props.paragraphs)) {
      const next = updateElements(design, [editing.id], (e) =>
        e.type === 'text' ? { ...e, props: { ...e.props, paragraphs } } : e,
      )
      onCommit(next, design)
    }
  }

  const selectedBoxes = selection.flatMap((id) => {
    const g = geometry.get(id)
    return g ? [{ id, g }] : []
  })
  const groupBox = selectedBoxes.length > 1 ? union(selectedBoxes.map(({ g }) => bounds(g))) : null
  const single = selectedBoxes.length === 1 ? selectedBoxes[0] : null
  const handleBox: (Box & { rotation: number }) | null = single
    ? { ...single.g, rotation: single.g.rotation }
    : groupBox
      ? { ...groupBox, rotation: 0 }
      : null
  const showHandles = handleBox && !readOnly && !editingId && selectable(selection).length > 0

  return (
    <div
      className={`dz-canvas${showGrid ? ' dz-canvas--grid' : ''}`}
      ref={canvasRef}
      style={{ width: size.width * zoom, height: size.height * zoom, ['--zoom' as string]: zoom }}
      onPointerDown={startBackground}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu({ x: e.clientX, y: e.clientY }, null)
      }}
    >
      <DesignCanvas
        design={design}
        view={view}
        data={data}
        unit={zoom}
        publicOnly={false}
        renderElement={(el, g, z, content) => {
          const hidden = el.hidden || g.hidden
          return (
            <div
              data-id={el.id}
              className={[
                'dc-el',
                `dc-el--${el.type}`,
                'dz-el',
                hidden ? 'dz-el--hidden' : '',
                overflow.has(el.id) ? 'dz-el--overflow' : '',
                el.locked ? 'dz-el--locked' : '',
              ].join(' ')}
              style={boxStyle(el, g, z)}
              onPointerDown={(e) => startMove(e, el)}
              onDoubleClick={(e) => {
                e.stopPropagation()
                if (el.type === 'text' && !readOnly && !el.locked) onEditText(el.id)
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (!selection.includes(el.id)) onSelect(expandGroups(design, [el.id]))
                onContextMenu({ x: e.clientX, y: e.clientY }, el.id)
              }}
              title={hidden ? 'Hidden' : undefined}
            >
              {editingId === el.id ? null : content}
            </div>
          )
        }}
      />

      {editing && editing.type === 'text' && (
        <div
          ref={editorRef}
          className="dz-text-editor dc-text"
          contentEditable
          suppressContentEditableWarning
          style={{
            ...boxStyle(editing, geometry.get(editing.id)!, 9999),
            position: 'absolute',
            height: 'auto',
            minHeight: geometry.get(editing.id)!.h * zoom,
            ['--u' as string]: `${zoom}px`,
            fontFamily: fontFamily(editing.props.font),
            fontSize: editing.props.size * (geometry.get(editing.id)!.fontScale ?? 1) * zoom,
            color: editing.props.color,
            fontWeight: editing.props.weight,
            textAlign: editing.props.align,
            lineHeight: editing.props.lineHeight,
            letterSpacing: editing.props.letterSpacing * zoom,
            textTransform: editing.props.transform === 'none' ? undefined : editing.props.transform,
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={(e) => {
            // Clicks on the text toolbar keep editing going.
            if ((e.relatedTarget as HTMLElement | null)?.closest('.dz-texttools')) return
            finishEditing()
            onEditText(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              finishEditing()
              onEditText(null)
            }
            e.stopPropagation()
          }}
          data-editing-id={editing.id}
        />
      )}

      <div className="dz-overlay" aria-hidden="true">
        {selectedBoxes.map(({ id, g }) => (
          <div
            key={id}
            className="dz-outline"
            style={{
              left: g.x * zoom,
              top: g.y * zoom,
              width: g.w * zoom,
              height: g.h * zoom,
              transform: g.rotation ? `rotate(${g.rotation}deg)` : undefined,
            }}
          />
        ))}
        {groupBox && (
          <div
            className="dz-outline dz-outline--group"
            style={{
              left: groupBox.x * zoom,
              top: groupBox.y * zoom,
              width: groupBox.w * zoom,
              height: groupBox.h * zoom,
            }}
          />
        )}
        {showHandles && handleBox && (
          <div
            className="dz-handles"
            style={{
              left: handleBox.x * zoom,
              top: handleBox.y * zoom,
              width: handleBox.w * zoom,
              height: handleBox.h * zoom,
              transform: handleBox.rotation ? `rotate(${handleBox.rotation}deg)` : undefined,
            }}
          >
            {HANDLES.map((h) => (
              <span
                key={h}
                className={`dz-handle dz-handle--${h}`}
                onPointerDown={(e) => startHandle(e, h, handleBox)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              />
            ))}
            <span
              className="dz-handle dz-handle--rotate"
              title="Rotate (Shift: 15° steps)"
              onPointerDown={(e) => startHandle(e, 'rotate', handleBox)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              ↻
            </span>
            {single && (
              <span className="dz-size-label">
                {Math.round(single.g.w)} × {Math.round(single.g.h)}
                {single.g.rotation ? ` · ${Math.round(single.g.rotation)}°` : ''}
              </span>
            )}
          </div>
        )}
        {view === 'desktop' && (
          <UserGuides
            design={design}
            zoom={zoom}
            size={size}
            rulers={rulers && !readOnly}
            toCanvas={toCanvas}
            onCommit={onCommit}
          />
        )}
        {guides.map((g, i) => (
          <div
            key={i}
            className="dz-guide"
            style={
              g.axis === 'x'
                ? {
                    left: g.at * zoom,
                    top: g.from * zoom,
                    width: 1,
                    height: (g.to - g.from) * zoom,
                  }
                : {
                    top: g.at * zoom,
                    left: g.from * zoom,
                    height: 1,
                    width: (g.to - g.from) * zoom,
                  }
            }
          />
        ))}
        {marquee && (
          <div
            className="dz-marquee"
            style={{
              left: marquee.x * zoom,
              top: marquee.y * zoom,
              width: marquee.w * zoom,
              height: marquee.h * zoom,
            }}
          />
        )}
      </div>
    </div>
  )
}

/**
 * Rulers along the top and left of the canvas, and the guide lines dragged
 * out of them. Drag a guide back off the canvas to remove it.
 */
function UserGuides({
  design,
  zoom,
  size,
  rulers,
  toCanvas,
  onCommit,
}: {
  design: Design
  zoom: number
  size: { width: number; height: number }
  rulers: boolean
  toCanvas: (event: { clientX: number; clientY: number }) => Point
  onCommit: (design: Design, before: Design) => void
}) {
  const [dragging, setDragging] = useState<{
    axis: 'x' | 'y'
    index: number | null
    at: number
  } | null>(null)
  const lines = design.guides ?? { x: [], y: [] }
  const limit = { x: size.width, y: size.height }

  const start = (axis: 'x' | 'y', index: number | null) => (event: React.PointerEvent) => {
    if (!rulers) return
    event.stopPropagation()
    event.preventDefault()
    try {
      ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    } catch {
      // Not every pointer can be captured; the drag still works over the ruler and canvas.
    }
    const p = toCanvas(event)
    setDragging({ axis, index, at: axis === 'x' ? p.x : p.y })
  }
  const move = (event: React.PointerEvent) => {
    if (!dragging) return
    const p = toCanvas(event)
    setDragging({ ...dragging, at: Math.round(dragging.axis === 'x' ? p.x : p.y) })
  }
  const end = () => {
    if (!dragging) return
    const { axis, index, at } = dragging
    setDragging(null)
    const list = [...lines[axis]]
    if (index !== null) list.splice(index, 1)
    if (at >= 0 && at <= limit[axis]) list.push(at)
    onCommit({ ...design, guides: { ...lines, [axis]: list } }, design)
  }
  const handlers = { onPointerMove: move, onPointerUp: end, onPointerCancel: end }
  const step = zoom < 0.4 ? 200 : 100
  const ticks = (length: number) =>
    Array.from({ length: Math.floor(length / step) + 1 }, (_, i) => i * step)

  const line = (axis: 'x' | 'y', at: number, index: number | null, live = false) => (
    <div
      key={`${axis}-${index ?? 'new'}`}
      className={`dz-userguide dz-userguide--${axis}${live ? ' dz-userguide--live' : ''}`}
      style={axis === 'x' ? { left: at * zoom } : { top: at * zoom }}
      onPointerDown={start(axis, index)}
      {...handlers}
      title={rulers ? 'Drag to move; drag off the page to remove' : undefined}
    />
  )

  return (
    <>
      {lines.x.map((at, i) =>
        dragging?.axis === 'x' && dragging.index === i ? null : line('x', at, i),
      )}
      {lines.y.map((at, i) =>
        dragging?.axis === 'y' && dragging.index === i ? null : line('y', at, i),
      )}
      {dragging && line(dragging.axis, dragging.at, null, true)}
      {rulers && (
        <>
          <div
            className="dz-ruler dz-ruler--top"
            onPointerDown={start('y', null)}
            {...handlers}
            title="Drag down to add a guide"
          >
            {ticks(size.width).map((t) => (
              <span key={t} style={{ left: t * zoom }}>
                {t}
              </span>
            ))}
          </div>
          <div
            className="dz-ruler dz-ruler--left"
            onPointerDown={start('x', null)}
            {...handlers}
            title="Drag right to add a guide"
          >
            {ticks(size.height).map((t) => (
              <span key={t} style={{ top: t * zoom }}>
                {t}
              </span>
            ))}
          </div>
        </>
      )}
    </>
  )
}
