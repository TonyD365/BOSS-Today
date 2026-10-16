import { type Design, type DesignElement, type Geometry, PHONE_WIDTH } from './types'

/**
 * Phones get their own canvas. Elements someone has placed by hand keep that
 * place; the rest are stacked in reading order (top to bottom, then left to
 * right) below them, full width, with text scaled down where it would be too
 * big. Decorative backgrounds wider than a phone are hidden.
 */
const MARGIN = 16
const GAP = 16
const CONTENT = PHONE_WIDTH - MARGIN * 2
const MAX_TEXT = 34

const textHeight = (el: Extract<DesignElement, { type: 'text' }>, scale: number) => {
  const size = el.props.size * scale
  const perLine = Math.max(1, Math.floor(CONTENT / (size * 0.52)))
  const lines = el.props.paragraphs.reduce(
    (sum, p) => sum + Math.max(1, Math.ceil(p.runs.map((r) => r.text).join('').length / perLine)),
    0,
  )
  return Math.ceil(lines * size * el.props.lineHeight + (el.props.background?.padding ?? 0) * 2 + 4)
}

/** Where an element goes when nobody has placed it on the phone canvas. */
const autoGeometry = (el: DesignElement, y: number): Geometry => {
  const at = { x: MARGIN, y, w: CONTENT, rotation: 0, hidden: el.hidden }
  switch (el.type) {
    case 'text': {
      const scale = Math.min(1, MAX_TEXT / el.props.size)
      return { ...at, h: textHeight(el, scale), fontScale: scale }
    }
    case 'shape':
      if (el.props.kind === 'line') return { ...at, h: el.h }
      // Backgrounds wider than a phone, and tall thin column rules, don't fit a single column.
      if (el.w > PHONE_WIDTH * 1.5 || el.h > el.w * 8) return { ...at, h: el.h, hidden: true }
      return {
        ...at,
        x: (PHONE_WIDTH - Math.min(el.w, CONTENT)) / 2,
        w: Math.min(el.w, CONTENT),
        h: el.h * Math.min(1, CONTENT / el.w),
      }
    case 'image':
      return { ...at, h: Math.round((CONTENT * el.h) / el.w) }
    case 'story': {
      // Pictures always sit on top on a phone (see design.css).
      const image = el.props.showImage ? Math.round(CONTENT * 0.6) : 0
      const scale = Math.min(1, 28 / el.props.headlineSize)
      return { ...at, h: image + 150 + (el.props.showSummary ? 60 : 0), fontScale: scale }
    }
    case 'list': {
      // On a phone each story is a full-width row: a 3:2 picture plus a two-line headline.
      const withPictures = el.props.showImage && el.props.kind !== 'mostread'
      const row = withPictures ? Math.round((CONTENT * 2) / 3) + 72 : 84
      return { ...at, h: (el.props.title ? 48 : 8) + el.props.count * row }
    }
    case 'site': {
      // The navigation becomes a menu button on phones (see the site part renderer).
      const scale = Math.min(1, 40 / el.props.size)
      const heights: Record<typeof el.props.kind, number> = {
        nav: 40,
        search: 40,
        date: 20,
        theme: 20,
        sitename: Math.ceil(el.props.size * scale * 1.25),
        staff: 24,
        links: 96,
        tagline: 48,
      }
      return { ...at, h: heights[el.props.kind], fontScale: scale }
    }
    case 'widget':
      return {
        ...at,
        h:
          el.props.kind === 'live'
            ? 56
            : el.props.kind === 'issue'
              ? 120
              : 48 + el.props.count * 54,
      }
  }
}

/** Top to bottom, then left to right; elements starting within 24px count as one row. */
export const readingOrder = (elements: DesignElement[]) =>
  [...elements].sort((a, b) => (Math.abs(a.y - b.y) < 24 ? a.x - b.x : a.y - b.y))

const PAD = 16

const inside = (inner: DesignElement, outer: DesignElement) =>
  inner.x >= outer.x - 2 &&
  inner.y >= outer.y - 2 &&
  inner.x + inner.w <= outer.x + outer.w + 2 &&
  inner.y + inner.h <= outer.y + outer.h + 2

/**
 * A filled shape with things on top of it (a coloured band behind a heading)
 * is a block: on the phone it becomes a full-width band with its contents
 * stacked inside, so text keeps the background it was designed on.
 */
const blocks = (elements: DesignElement[]) => {
  const owner = new Map<string, string>()
  elements.forEach((el, index) => {
    let best: DesignElement | null = null
    for (let i = 0; i < index; i++) {
      const below = elements[i]
      if (below.type !== 'shape' || below.props.kind === 'line' || below.props.fill.type === 'none')
        continue
      if (below.hidden || below.rotation !== 0 || !inside(el, below)) continue
      if (!best || below.w * below.h < best.w * best.h) best = below
    }
    if (best) owner.set(el.id, best.id)
  })
  const children = new Map<string, DesignElement[]>()
  for (const el of elements) {
    const parent = owner.get(el.id)
    if (parent && !owner.has(parent)) children.set(parent, [...(children.get(parent) ?? []), el])
    else if (parent) owner.delete(el.id)
  }
  return { owner, children }
}

/** Every element's phone geometry, by id. */
export const phoneLayout = (design: Design): Map<string, Geometry> => {
  const result = new Map<string, Geometry>()
  const { overrides } = design.phone
  const elements = design.desktop.elements
  let bottom = 0
  for (const el of elements) {
    const placed = overrides[el.id]
    if (placed) {
      result.set(el.id, placed)
      if (!placed.hidden) bottom = Math.max(bottom, placed.y + placed.h)
    }
  }
  const { owner, children } = blocks(elements)
  let y = bottom > 0 ? bottom + GAP : MARGIN
  for (const el of readingOrder(elements)) {
    if (result.has(el.id) || owner.has(el.id)) continue
    const inner = (children.get(el.id) ?? []).filter((child) => !result.has(child.id))
    if (inner.length > 0) {
      // The band runs edge to edge; its contents stack inside it.
      let innerY = y + PAD
      for (const child of readingOrder(inner)) {
        const g = autoGeometry(child, innerY)
        result.set(child.id, g)
        if (!g.hidden) innerY += g.h + GAP
      }
      const band: Geometry = {
        x: 0,
        y,
        w: PHONE_WIDTH,
        h: innerY - GAP + PAD - y,
        rotation: 0,
        hidden: el.hidden,
      }
      result.set(el.id, band)
      y += band.h + GAP
      continue
    }
    const geometry = autoGeometry(el, y)
    result.set(el.id, geometry)
    if (!geometry.hidden) y += geometry.h + GAP
  }
  return result
}

export const phoneGeometry = (design: Design, id: string) => phoneLayout(design).get(id) ?? null

/** Elements laid out automatically on the phone, i.e. not yet placed by hand. */
export const unplacedOnPhone = (design: Design) =>
  design.desktop.elements.filter((el) => !design.phone.overrides[el.id]).map((el) => el.id)

export const phoneHeight = (design: Design, layout = phoneLayout(design)) => {
  let bottom = 0
  for (const g of layout.values()) if (!g.hidden) bottom = Math.max(bottom, g.y + g.h)
  return Math.max(400, Math.ceil(bottom + 32))
}
