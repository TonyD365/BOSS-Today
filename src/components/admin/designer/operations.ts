import { newId } from '@/design/defaults'
import { phoneLayout } from '@/design/phone'
import type { Design, DesignElement, Geometry } from '@/design/types'

import { bounds, type Box, union } from './geometry'

export type View = 'desktop' | 'phone'

const clone = <T>(value: T): T => structuredClone(value)

export const geometryMap = (design: Design, view: View): Map<string, Geometry> =>
  view === 'desktop'
    ? new Map(design.desktop.elements.map((el) => [el.id, el as Geometry]))
    : phoneLayout(design)

const pickGeometry = (g: Geometry): Geometry => ({
  x: g.x,
  y: g.y,
  w: g.w,
  h: g.h,
  rotation: g.rotation,
  hidden: g.hidden,
  ...(g.fontScale !== undefined ? { fontScale: g.fontScale } : {}),
})

/**
 * The first hand-made change on the phone pins every element where the
 * automatic layout put it, so later desktop additions go below them.
 */
const pinPhone = (design: Design) => {
  const layout = phoneLayout(design)
  for (const el of design.desktop.elements) {
    if (!design.phone.overrides[el.id]) {
      const g = layout.get(el.id)
      if (g) design.phone.overrides[el.id] = pickGeometry(g)
    }
  }
}

/** Applies geometry changes in the current view. */
export const setGeometry = (
  design: Design,
  view: View,
  changes: Record<string, Partial<Geometry>>,
): Design => {
  const next = clone(design)
  if (view === 'desktop') {
    next.desktop.elements = next.desktop.elements.map((el) =>
      changes[el.id] ? ({ ...el, ...changes[el.id] } as DesignElement) : el,
    )
  } else {
    pinPhone(next)
    for (const [id, change] of Object.entries(changes)) {
      const current = next.phone.overrides[id]
      if (current) next.phone.overrides[id] = { ...current, ...change }
    }
  }
  return next
}

export const updateElements = (
  design: Design,
  ids: string[],
  update: (el: DesignElement) => DesignElement,
): Design => {
  const next = clone(design)
  const set = new Set(ids)
  next.desktop.elements = next.desktop.elements.map((el) => (set.has(el.id) ? update(el) : el))
  return next
}

export const addElement = (
  design: Design,
  el: DesignElement,
  view: View,
  at?: Geometry,
): Design => {
  const next = clone(design)
  next.desktop.elements.push(el)
  if (el.y + el.h > next.desktop.height) next.desktop.height = Math.ceil(el.y + el.h + 40)
  if (view === 'phone' && at) {
    pinPhone(next)
    next.phone.overrides[el.id] = pickGeometry(at)
  }
  return next
}

/** On the desktop, deletes. On the phone, hides there only. */
export const removeElements = (design: Design, ids: string[], view: View): Design => {
  if (view === 'phone') {
    return setGeometry(design, view, Object.fromEntries(ids.map((id) => [id, { hidden: true }])))
  }
  const next = clone(design)
  const set = new Set(ids)
  next.desktop.elements = next.desktop.elements.filter((el) => !set.has(el.id))
  for (const id of ids) delete next.phone.overrides[id]
  return next
}

export type Order = 'front' | 'forward' | 'backward' | 'back'

export const reorder = (design: Design, ids: string[], order: Order): Design => {
  const next = clone(design)
  const set = new Set(ids)
  const els = next.desktop.elements
  const moving = els.filter((el) => set.has(el.id))
  const rest = els.filter((el) => !set.has(el.id))
  if (order === 'front') next.desktop.elements = [...rest, ...moving]
  else if (order === 'back') next.desktop.elements = [...moving, ...rest]
  else {
    const list = [...els]
    const step = order === 'forward' ? 1 : -1
    const indexes = list.map((el, i) => (set.has(el.id) ? i : -1)).filter((i) => i >= 0)
    if (step > 0) indexes.reverse()
    for (const i of indexes) {
      const j = i + step
      if (j < 0 || j >= list.length || set.has(list[j].id)) continue
      ;[list[i], list[j]] = [list[j], list[i]]
    }
    next.desktop.elements = list
  }
  return next
}

/** Clicking one member of a group selects the whole group. */
export const expandGroups = (design: Design, ids: string[]) => {
  const groups = new Set(
    design.desktop.elements
      .filter((el) => ids.includes(el.id) && el.groupId)
      .map((el) => el.groupId),
  )
  return design.desktop.elements
    .filter((el) => ids.includes(el.id) || (el.groupId && groups.has(el.groupId)))
    .map((el) => el.id)
}

export const group = (design: Design, ids: string[]) => {
  const groupId = newId()
  return updateElements(design, ids, (el) => ({ ...el, groupId }))
}

export const ungroup = (design: Design, ids: string[]) =>
  updateElements(design, ids, (el) => ({ ...el, groupId: null }))

export const selectionBox = (design: Design, view: View, ids: string[]): Box | null => {
  const map = geometryMap(design, view)
  return union(ids.flatMap((id) => (map.get(id) ? [bounds(map.get(id)!)] : [])))
}

export type Align = 'left' | 'hcenter' | 'right' | 'top' | 'vmiddle' | 'bottom'

/** One element aligns to the canvas; several align to their shared box. */
export const align = (
  design: Design,
  view: View,
  ids: string[],
  how: Align,
  canvas: { w: number; h: number },
) => {
  const map = geometryMap(design, view)
  const target =
    ids.length === 1 ? { x: 0, y: 0, w: canvas.w, h: canvas.h } : selectionBox(design, view, ids)
  if (!target) return design
  const changes: Record<string, Partial<Geometry>> = {}
  for (const id of ids) {
    const g = map.get(id)
    if (!g) continue
    const b = bounds(g)
    let dx = 0
    let dy = 0
    if (how === 'left') dx = target.x - b.x
    if (how === 'hcenter') dx = target.x + target.w / 2 - (b.x + b.w / 2)
    if (how === 'right') dx = target.x + target.w - (b.x + b.w)
    if (how === 'top') dy = target.y - b.y
    if (how === 'vmiddle') dy = target.y + target.h / 2 - (b.y + b.h / 2)
    if (how === 'bottom') dy = target.y + target.h - (b.y + b.h)
    changes[id] = { x: g.x + dx, y: g.y + dy }
  }
  return setGeometry(design, view, changes)
}

/** Equal gaps between three or more elements. */
export const distribute = (design: Design, view: View, ids: string[], axis: 'x' | 'y') => {
  if (ids.length < 3) return design
  const map = geometryMap(design, view)
  const items = ids
    .flatMap((id) => (map.get(id) ? [{ id, g: map.get(id)!, b: bounds(map.get(id)!) }] : []))
    .sort((a, b) => (axis === 'x' ? a.b.x - b.b.x : a.b.y - b.b.y))
  const size = (b: Box) => (axis === 'x' ? b.w : b.h)
  const start = axis === 'x' ? items[0].b.x : items[0].b.y
  const last = items[items.length - 1].b
  const end = axis === 'x' ? last.x + last.w : last.y + last.h
  const gap = (end - start - items.reduce((sum, i) => sum + size(i.b), 0)) / (items.length - 1)
  let cursor = start
  const changes: Record<string, Partial<Geometry>> = {}
  for (const item of items) {
    const shift = cursor - (axis === 'x' ? item.b.x : item.b.y)
    changes[item.id] = axis === 'x' ? { x: item.g.x + shift } : { y: item.g.y + shift }
    cursor += size(item.b) + gap
  }
  return setGeometry(design, view, changes)
}

/** Copies with new ids (and new group ids), offset so they don't sit exactly on top. */
export const duplicates = (els: DesignElement[], offset = 20): DesignElement[] => {
  const groups = new Map<string, string>()
  return els.map((el) => {
    const copy = clone(el)
    copy.id = newId()
    if (copy.groupId) {
      if (!groups.has(copy.groupId)) groups.set(copy.groupId, newId())
      copy.groupId = groups.get(copy.groupId)!
    }
    copy.x += offset
    copy.y += offset
    copy.locked = false
    return copy
  })
}

export const pasteElements = (
  design: Design,
  els: DesignElement[],
): { design: Design; ids: string[] } => {
  const next = clone(design)
  next.desktop.elements.push(...els)
  return { design: next, ids: els.map((el) => el.id) }
}
