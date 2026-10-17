import type { Geometry } from '@/design/types'

export type Box = { x: number; y: number; w: number; h: number }
export type Point = { x: number; y: number }
export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

const rad = (deg: number) => (deg * Math.PI) / 180

export const rotate = (p: Point, deg: number): Point => {
  const r = rad(deg)
  return { x: p.x * Math.cos(r) - p.y * Math.sin(r), y: p.x * Math.sin(r) + p.y * Math.cos(r) }
}

export const center = (g: Box): Point => ({ x: g.x + g.w / 2, y: g.y + g.h / 2 })

/** The upright box around a (possibly rotated) element. */
export const bounds = (g: Box & { rotation?: number }): Box => {
  const c = center(g)
  const corners = [
    { x: -g.w / 2, y: -g.h / 2 },
    { x: g.w / 2, y: -g.h / 2 },
    { x: g.w / 2, y: g.h / 2 },
    { x: -g.w / 2, y: g.h / 2 },
  ].map((p) => rotate(p, g.rotation ?? 0))
  const xs = corners.map((p) => p.x + c.x)
  const ys = corners.map((p) => p.y + c.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

export const union = (boxes: Box[]): Box | null => {
  if (boxes.length === 0) return null
  const x = Math.min(...boxes.map((b) => b.x))
  const y = Math.min(...boxes.map((b) => b.y))
  return {
    x,
    y,
    w: Math.max(...boxes.map((b) => b.x + b.w)) - x,
    h: Math.max(...boxes.map((b) => b.y + b.h)) - y,
  }
}

export const intersects = (a: Box, b: Box) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

const SIGNS: Record<Handle, { x: -1 | 0 | 1; y: -1 | 0 | 1 }> = {
  nw: { x: -1, y: -1 },
  n: { x: 0, y: -1 },
  ne: { x: 1, y: -1 },
  e: { x: 1, y: 0 },
  se: { x: 1, y: 1 },
  s: { x: 0, y: 1 },
  sw: { x: -1, y: 1 },
  w: { x: -1, y: 0 },
}

export const handleSigns = (handle: Handle) => SIGNS[handle]

/**
 * Resizes a rotated box by dragging one handle, keeping the opposite side
 * fixed in place. With `keepRatio`, corners keep the original proportions.
 */
export const resizeBox = (
  start: Geometry,
  handle: Handle,
  pointer: Point,
  keepRatio: boolean,
  min = 4,
): Geometry => {
  const s = SIGNS[handle]
  const c = center(start)
  const local = rotate({ x: pointer.x - c.x, y: pointer.y - c.y }, -start.rotation)
  const fixed = { x: (-s.x * start.w) / 2, y: (-s.y * start.h) / 2 }
  let w = s.x === 0 ? start.w : Math.max(min, s.x * (local.x - fixed.x))
  let h = s.y === 0 ? start.h : Math.max(min, s.y * (local.y - fixed.y))
  if (keepRatio && s.x !== 0 && s.y !== 0) {
    const ratio = start.w / start.h
    if (w / h > ratio) h = w / ratio
    else w = h * ratio
  }
  const newCenterLocal = {
    x: s.x === 0 ? 0 : fixed.x + (s.x * w) / 2,
    y: s.y === 0 ? 0 : fixed.y + (s.y * h) / 2,
  }
  const offset = rotate(newCenterLocal, start.rotation)
  const cx = c.x + offset.x
  const cy = c.y + offset.y
  return { ...start, x: cx - w / 2, y: cy - h / 2, w, h }
}

/** Degrees from the box centre to the pointer, 0 = straight up. */
export const angleTo = (c: Point, p: Point) =>
  (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI + 90

export const normalizeAngle = (deg: number) => {
  let a = deg % 360
  if (a > 180) a -= 360
  if (a <= -180) a += 360
  return Math.round(a * 10) / 10
}

/** Rotation that clicks to 15° steps with Shift, and to right angles when close. */
export const snapAngle = (deg: number, shift: boolean) => {
  if (shift) return Math.round(deg / 15) * 15
  for (const target of [-180, -90, 0, 90, 180]) if (Math.abs(deg - target) < 3) return target
  return deg
}

export type Guide = { axis: 'x' | 'y'; at: number; from: number; to: number }

/**
 * Snaps a moving box's edges and centre to other boxes and the canvas. Returns
 * the shift to apply and the guide lines to draw.
 */
export const snapMove = (
  moving: Box,
  others: Box[],
  canvas: { w: number; h: number },
  threshold: number,
  lines: { x: number[]; y: number[] } = { x: [], y: [] },
): { dx: number; dy: number; guides: Guide[] } => {
  const targetsX: { at: number; box?: Box }[] = [
    { at: 0 },
    { at: canvas.w / 2 },
    { at: canvas.w },
    ...lines.x.map((at) => ({ at })),
  ]
  const targetsY: { at: number; box?: Box }[] = [{ at: 0 }, ...lines.y.map((at) => ({ at }))]
  for (const b of others) {
    targetsX.push({ at: b.x, box: b }, { at: b.x + b.w / 2, box: b }, { at: b.x + b.w, box: b })
    targetsY.push({ at: b.y, box: b }, { at: b.y + b.h / 2, box: b }, { at: b.y + b.h, box: b })
  }
  const best = (edges: number[], targets: { at: number; box?: Box }[]) => {
    let found: { delta: number; at: number; box?: Box } | null = null
    for (const edge of edges) {
      for (const t of targets) {
        const delta = t.at - edge
        if (Math.abs(delta) <= threshold && (!found || Math.abs(delta) < Math.abs(found.delta))) {
          found = { delta, at: t.at, box: t.box }
        }
      }
    }
    return found
  }
  const sx = best([moving.x, moving.x + moving.w / 2, moving.x + moving.w], targetsX)
  const sy = best([moving.y, moving.y + moving.h / 2, moving.y + moving.h], targetsY)
  const guides: Guide[] = []
  const dx = sx?.delta ?? 0
  const dy = sy?.delta ?? 0
  if (sx) {
    const top = Math.min(moving.y + dy, sx.box?.y ?? 0)
    const bottom = Math.max(moving.y + dy + moving.h, sx.box ? sx.box.y + sx.box.h : canvas.h)
    guides.push({ axis: 'x', at: sx.at, from: top, to: bottom })
  }
  if (sy) {
    const left = Math.min(moving.x + dx, sy.box?.x ?? 0)
    const right = Math.max(moving.x + dx + moving.w, sy.box ? sy.box.x + sy.box.w : canvas.w)
    guides.push({ axis: 'y', at: sy.at, from: left, to: right })
  }
  return { dx, dy, guides }
}

export const snapToGrid = (value: number, grid: number) => Math.round(value / grid) * grid
