import { contrast, flatten, isColor, readableNear, representative, requiredContrast } from './color'
import {
  imageDefaults,
  listDefaults,
  shapeDefaults,
  siteDefaults,
  storyDefaults,
  textDefaults,
  widgetDefaults,
} from './defaults'
import { isFont } from './fonts'
import { phoneLayout } from './phone'
import { cleanParagraphs } from './richtext'
import {
  ARTICLE_PARTS,
  type IconPath,
  IMAGE_MASKS,
  type Color,
  type Design,
  type DesignElement,
  DESKTOP_WIDTH,
  type Fill,
  type Geometry,
  type PageTemplate,
  PHONE_WIDTH,
  SHAPES,
  SIDE_WIDTH,
  SITE_PARTS,
  TEMPLATE_KINDS,
  type Templates,
} from './types'

export const MAX_ELEMENTS = 300
const MAX_HEIGHT = 20000

const num = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback
const bool = (value: unknown, fallback = false) => (typeof value === 'boolean' ? value : fallback)
const color = (value: unknown, fallback: Color) => (isColor(value) ? value : fallback)
const pick = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback
const id = (value: unknown) =>
  typeof value === 'string' && /^[a-z0-9_-]{1,40}$/i.test(value) ? value : null
const link = (value: unknown) =>
  typeof value === 'string' && /^(https?:\/\/|\/)[^\s<>"']{0,500}$/.test(value) ? value : null
const ref = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '')

export const cleanFill = (value: unknown, fallback: Fill = { type: 'none' }): Fill => {
  const fill = (value ?? {}) as Record<string, unknown>
  if (fill.type === 'solid' && isColor(fill.color)) return { type: 'solid', color: fill.color }
  if (fill.type === 'linear' && Array.isArray(fill.stops)) {
    const stops = fill.stops
      .slice(0, 6)
      .map((stop) => (stop ?? {}) as Record<string, unknown>)
      .filter((stop) => isColor(stop.color))
      .map((stop) => ({ color: stop.color as Color, at: num(stop.at, 0, 1, 0) }))
    if (stops.length >= 2) return { type: 'linear', angle: num(fill.angle, 0, 360, 90), stops }
  }
  if (fill.type === 'none') return { type: 'none' }
  return fallback
}

const cleanProps = (type: DesignElement['type'], raw: Record<string, unknown>) => {
  switch (type) {
    case 'text': {
      const d = textDefaults()
      const shadow = raw.shadow as Record<string, unknown> | null
      const outline = raw.outline as Record<string, unknown> | null
      const background = raw.background as Record<string, unknown> | null
      return {
        paragraphs: cleanParagraphs(raw.paragraphs),
        font: isFont(raw.font) ? raw.font : d.font,
        size: num(raw.size, 6, 300, d.size),
        color: color(raw.color, d.color),
        weight: raw.weight === 400 ? 400 : 700,
        align: pick(raw.align, ['left', 'center', 'right', 'justify'] as const, 'left'),
        lineHeight: num(raw.lineHeight, 0.7, 3, d.lineHeight),
        letterSpacing: num(raw.letterSpacing, -5, 30, 0),
        transform: pick(raw.transform, ['none', 'uppercase', 'lowercase'] as const, 'none'),
        shadow: shadow
          ? {
              x: num(shadow.x, -50, 50, 2),
              y: num(shadow.y, -50, 50, 2),
              blur: num(shadow.blur, 0, 50, 4),
              color: color(shadow.color, '#00000066'),
            }
          : null,
        outline: outline
          ? { width: num(outline.width, 0.5, 10, 1), color: color(outline.color, '#121212') }
          : null,
        background: background
          ? {
              color: color(background.color, '#f6f1e7'),
              padding: num(background.padding, 0, 60, 8),
              radius: num(background.radius, 0, 60, 4),
            }
          : null,
        curve: num(raw.curve, -100, 100, 0),
        autoHeight: bool(raw.autoHeight, true),
      }
    }
    case 'shape': {
      const kind = pick(raw.kind, SHAPES, 'rect')
      const d = shapeDefaults(kind)
      const stroke = raw.stroke as Record<string, unknown> | null
      return {
        kind,
        fill: cleanFill(raw.fill, d.fill),
        stroke: stroke
          ? {
              color: color(stroke.color, '#121212'),
              width: num(stroke.width, 0.5, 40, 2),
              dash: pick(stroke.dash, ['solid', 'dashed', 'dotted'] as const, 'solid'),
            }
          : kind === 'line'
            ? d.stroke
            : null,
        radius: num(raw.radius, 0, 600, 0),
        points: Math.round(num(raw.points, 3, 12, d.points)),
        arrowStart: bool(raw.arrowStart),
        arrowEnd: bool(raw.arrowEnd),
      }
    }
    case 'icon': {
      // Only plain path data: letters for commands, numbers, spaces, commas and signs.
      const safe = (d: unknown) =>
        typeof d === 'string' && d.length <= 4000 && /^[MmLlHhVvCcSsQqTtAaZz0-9.,\se+-]*$/.test(d)
      const paths = (Array.isArray(raw.paths) ? raw.paths : [])
        .slice(0, 40)
        .flatMap((path: unknown): IconPath[] =>
          safe(path)
            ? [path as string]
            : Array.isArray(path) && safe(path[0])
              ? [[path[0] as string, 1 as const] as [string, 1]]
              : [],
        )
      return {
        name: typeof raw.name === 'string' ? raw.name.slice(0, 60) : 'icon',
        paths,
        color: color(raw.color, '#121212'),
        strokeWidth: num(raw.strokeWidth, 0.5, 4, 2),
      }
    }
    case 'image': {
      type Loose = Record<string, unknown> | undefined
      const cropRaw = raw.crop as Loose
      const filtersRaw = raw.filters as Loose
      const borderRaw = raw.border as Loose
      return {
        ...imageDefaults(),
        mediaId: ref(raw.mediaId),
        fit: pick(raw.fit, ['cover', 'contain'] as const, 'cover'),
        radius: num(raw.radius, 0, 600, 0),
        link: link(raw.link),
        crop: {
          x: num(cropRaw?.x, 0, 100, 50),
          y: num(cropRaw?.y, 0, 100, 50),
          zoom: num(cropRaw?.zoom, 1, 5, 1),
        },
        mask: pick(raw.mask, IMAGE_MASKS, 'none'),
        filters: {
          brightness: num(filtersRaw?.brightness, 0, 200, 100),
          contrast: num(filtersRaw?.contrast, 0, 200, 100),
          saturate: num(filtersRaw?.saturate, 0, 200, 100),
          grayscale: num(filtersRaw?.grayscale, 0, 100, 0),
          sepia: num(filtersRaw?.sepia, 0, 100, 0),
          blur: num(filtersRaw?.blur, 0, 40, 0),
        },
        shadow: bool(raw.shadow, false),
        border:
          borderRaw && typeof borderRaw === 'object'
            ? { color: color(borderRaw.color, '#121212'), width: num(borderRaw.width, 1, 40, 2) }
            : null,
      }
    }
    case 'story': {
      const d = storyDefaults()
      return {
        source: pick(raw.source, ['pick', 'latest', 'section'] as const, 'latest'),
        articleId: ref(raw.articleId),
        sectionId: ref(raw.sectionId),
        index: Math.round(num(raw.index, 1, 50, 1)),
        showImage: bool(raw.showImage, true),
        showKicker: bool(raw.showKicker, true),
        showSummary: bool(raw.showSummary, true),
        showByline: bool(raw.showByline, true),
        imagePosition: pick(raw.imagePosition, ['top', 'left', 'right'] as const, 'top'),
        headlineSize: num(raw.headlineSize, 10, 120, d.headlineSize),
        font: isFont(raw.font) ? raw.font : d.font,
        color: color(raw.color, d.color),
      }
    }
    case 'list': {
      const d = listDefaults()
      return {
        kind: pick(raw.kind, ['latest', 'mostread', 'section'] as const, 'latest'),
        sectionId: ref(raw.sectionId),
        count: Math.round(num(raw.count, 1, 12, d.count)),
        title: text(raw.title, 80),
        showImage: bool(raw.showImage),
        font: isFont(raw.font) ? raw.font : d.font,
        color: color(raw.color, d.color),
      }
    }
    case 'site': {
      const kind = pick(raw.kind, SITE_PARTS, 'nav')
      const d = siteDefaults({ kind })
      return {
        kind,
        font: isFont(raw.font) ? raw.font : d.font,
        size: num(raw.size, 6, 200, d.size),
        color: color(raw.color, d.color),
        weight: raw.weight === 700 ? 700 : 400,
        align: pick(raw.align, ['left', 'center', 'right'] as const, d.align),
        uppercase: bool(raw.uppercase),
        gap: num(raw.gap, 0, 120, d.gap),
      }
    }
    case 'widget': {
      const d = widgetDefaults()
      return {
        kind: pick(raw.kind, ['scores', 'events', 'live', 'issue'] as const, 'scores'),
        count: Math.round(num(raw.count, 1, 12, d.count)),
        title: text(raw.title, 80),
        color: color(raw.color, d.color),
      }
    }
  }
}

const cleanElement = (value: unknown): DesignElement | null => {
  const raw = (value ?? {}) as Record<string, unknown>
  const type = pick(
    raw.type,
    ['text', 'shape', 'image', 'story', 'list', 'widget', 'site', 'icon'] as const,
    'text',
  )
  const elementId = id(raw.id)
  if (!elementId || raw.type !== type) return null
  return {
    id: elementId,
    ...(typeof raw.name === 'string' && raw.name ? { name: raw.name.slice(0, 60) } : {}),
    type,
    x: num(raw.x, -DESKTOP_WIDTH, DESKTOP_WIDTH * 2, 0),
    y: num(raw.y, -1000, MAX_HEIGHT, 0),
    w: num(raw.w, 1, DESKTOP_WIDTH * 3, 100),
    h: num(raw.h, 1, MAX_HEIGHT, 100),
    rotation: num(raw.rotation, -360, 360, 0),
    flipX: bool(raw.flipX),
    flipY: bool(raw.flipY),
    opacity: num(raw.opacity, 0, 1, 1),
    locked: bool(raw.locked),
    hidden: bool(raw.hidden),
    groupId: id(raw.groupId),
    props: cleanProps(type, (raw.props ?? {}) as Record<string, unknown>),
  } as DesignElement
}

const cleanGeometry = (value: unknown): (Geometry & { auto?: boolean }) | null => {
  const raw = (value ?? {}) as Record<string, unknown>
  if (typeof raw !== 'object') return null
  return {
    x: num(raw.x, -PHONE_WIDTH, PHONE_WIDTH * 2, 0),
    y: num(raw.y, -1000, MAX_HEIGHT * 3, 0),
    w: num(raw.w, 1, PHONE_WIDTH * 3, 100),
    h: num(raw.h, 1, MAX_HEIGHT, 100),
    rotation: num(raw.rotation, -360, 360, 0),
    hidden: bool(raw.hidden),
    ...(typeof raw.fontScale === 'number' ? { fontScale: num(raw.fontScale, 0.2, 2, 1) } : {}),
    ...(raw.auto === true ? { auto: true } : {}),
  }
}

/** Accepts only what the renderer understands. Anything else is dropped or reset. */
export const cleanDesign = (value: unknown): Design => {
  const raw = (value ?? {}) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  const elements = (Array.isArray(raw.desktop?.elements) ? raw.desktop.elements : [])
    .slice(0, MAX_ELEMENTS)
    .map(cleanElement)
    .filter((el: DesignElement | null): el is DesignElement => el !== null)
  const seen = new Set<string>()
  const unique = elements.filter(
    (el: DesignElement) => !seen.has(el.id) && Boolean(seen.add(el.id)),
  )
  const overrides: Design['phone']['overrides'] = {}
  for (const [key, geometry] of Object.entries(raw.phone?.overrides ?? {})) {
    const clean = cleanGeometry(geometry)
    if (clean && seen.has(key)) overrides[key] = clean
  }
  const date = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null)
  return {
    version: 1,
    desktop: {
      ...(num(raw.desktop?.width, 200, DESKTOP_WIDTH, DESKTOP_WIDTH) !== DESKTOP_WIDTH
        ? { width: num(raw.desktop?.width, 200, DESKTOP_WIDTH, DESKTOP_WIDTH) }
        : {}),
      height: num(raw.desktop?.height, 200, MAX_HEIGHT, 1600),
      background: cleanFill(raw.desktop?.background, { type: 'solid', color: '#ffffff' }),
      elements: unique,
    },
    phone: { height: num(raw.phone?.height, 200, MAX_HEIGHT * 3, 2000), overrides },
    desktopChangedAt: date(raw.desktopChangedAt),
    phoneCheckedAt: date(raw.phoneCheckedAt),
  }
}

export type ContrastProblem = {
  id: string
  label: string
  view: 'desktop' | 'phone'
  ratio: number
  needed: number
  color: Color
  background: Color
  suggestion: Color
}

const contains = (g: Geometry, x: number, y: number) =>
  x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.h

/** The colour behind the middle of an element: the topmost shape there, else the page. */
const backgroundAt = (
  elements: DesignElement[],
  index: number,
  geometry: (el: DesignElement) => Geometry | null,
  page: Color,
): Color | 'image' => {
  const g = geometry(elements[index])!
  const cx = g.x + g.w / 2
  const cy = g.y + g.h / 2
  for (let i = index - 1; i >= 0; i--) {
    const below = elements[i]
    const bg = geometry(below)
    if (!bg || below.hidden || bg.hidden || !contains(bg, cx, cy)) continue
    if (below.type === 'image') return 'image'
    if (below.type === 'shape' && below.props.kind !== 'line') {
      const c = representative(below.props.fill, page)
      if (c)
        return below.opacity < 1
          ? flatten(
              `${c}${Math.round(below.opacity * 255)
                .toString(16)
                .padStart(2, '0')}`,
              page,
            )
          : c
    }
  }
  return page
}

/** Text that is hard to read against what is behind it. */
export const contrastProblems = (design: Design): ContrastProblem[] => {
  const page = representative(design.desktop.background) ?? '#ffffff'
  const problems: ContrastProblem[] = []
  const phone = phoneLayout(design)
  const views: ['desktop' | 'phone', (el: DesignElement) => Geometry | null][] = [
    ['desktop', (el) => el],
    ['phone', (el) => phone.get(el.id) ?? null],
  ]
  const elements = design.desktop.elements
  for (const [view, geometry] of views) {
    elements.forEach((el, index) => {
      const g = geometry(el)
      if (el.hidden || !g || g.hidden) return
      const checks: { color: Color; size: number; bold: boolean }[] = []
      let background: Color | 'image'
      if (el.type === 'text') {
        background = el.props.background
          ? flatten(el.props.background.color, page)
          : backgroundAt(elements, index, geometry, page)
        for (const p of el.props.paragraphs) {
          for (const run of p.runs) {
            if (!run.text.trim()) continue
            checks.push({
              color: run.color ?? el.props.color,
              size: run.size ?? el.props.size,
              bold: run.bold ?? el.props.weight === 700,
            })
          }
        }
        if (el.props.outline || el.props.shadow) return // Effects make contrast a judgement call.
      } else if (
        el.type === 'story' ||
        el.type === 'list' ||
        el.type === 'widget' ||
        el.type === 'site'
      ) {
        background = backgroundAt(elements, index, geometry, page)
        checks.push({ color: el.props.color, size: 15, bold: false })
      } else return
      if (background === 'image') return
      for (const check of checks) {
        const fg = flatten(check.color, background)
        const needed = requiredContrast(check.size, check.bold)
        const ratio = contrast(fg, background)
        if (ratio < needed) {
          problems.push({
            id: el.id,
            label: el.name || el.type,
            view,
            ratio: Math.round(ratio * 100) / 100,
            needed,
            color: check.color,
            background,
            suggestion: readableNear(check.color, background, needed),
          })
          break
        }
      }
    })
  }
  return problems
}

const hasPart = (design: Design | null, kinds: string[]) =>
  Boolean(
    design?.desktop.elements.some(
      (el) =>
        el.type === 'site' &&
        kinds.includes(el.props.kind) &&
        !el.hidden &&
        !design.phone.overrides[el.id]?.hidden,
    ),
  )

/**
 * Readers must always be able to find their way around and staff to sign in:
 * the header keeps its navigation, and the header or footer keeps the staff
 * sign-in link (on its own, or in the footer's links). Null means the classic
 * header or footer, which has both.
 */
export const chromeProblems = (header: Design | null, footer: Design | null): string[] => {
  const problems: string[] = []
  if (header && !hasPart(header, ['nav'])) {
    problems.push(
      'The header needs its navigation bar. You can restyle and move it, but not remove it or hide it (on desktop or phones).',
    )
  }
  if (footer && !hasPart(header, ['staff', 'links']) && !hasPart(footer, ['staff', 'links'])) {
    problems.push(
      'Keep the Staff sign-in link in the header or footer (on its own, or in the footer links).',
    )
  }
  return problems
}

/** A canvas with something on it, or null. */
export const designedOrNull = (value: unknown): Design | null => {
  if (!value || typeof value !== 'object') return null
  const design = cleanDesign(value)
  return design.desktop.elements.length > 0 ? design : null
}

export const cleanTemplate = (value: unknown): PageTemplate => {
  const raw = (value ?? {}) as Record<string, unknown>
  const pick = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
    options.includes(v as T) ? (v as T) : fallback
  const side = designedOrNull(raw.side)
  if (side) side.desktop.width = SIDE_WIDTH
  return {
    above: designedOrNull(raw.above),
    side,
    below: designedOrNull(raw.below),
    sidePosition: pick(raw.sidePosition, ['right', 'left'], 'right'),
    width: pick(raw.width, ['narrow', 'medium', 'wide'], 'medium'),
    align: pick(raw.align, ['center', 'left'], 'center'),
    headFont: isFont(raw.headFont) ? (raw.headFont as string) : null,
    bodyFont: isFont(raw.bodyFont) ? (raw.bodyFont as string) : null,
    hide: Array.isArray(raw.hide)
      ? ARTICLE_PARTS.filter((part) => (raw.hide as unknown[]).includes(part))
      : [],
    imageFirst: raw.imageFirst === true,
  }
}

export const cleanTemplates = (value: unknown): Templates => {
  const raw = (value ?? {}) as Record<string, unknown>
  const result: Templates = {}
  for (const kind of TEMPLATE_KINDS) if (raw[kind]) result[kind] = cleanTemplate(raw[kind])
  return result
}
