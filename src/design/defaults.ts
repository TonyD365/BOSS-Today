import { DEFAULT_SANS, DEFAULT_SERIF } from './fonts'
import { plainParagraphs } from './richtext'
import type {
  Design,
  DesignElement,
  ElementType,
  ImageProps,
  ListProps,
  ShapeKind,
  ShapeProps,
  SitePart,
  SiteProps,
  StoryProps,
  TextProps,
  WidgetProps,
} from './types'

export const newId = () => Math.random().toString(36).slice(2, 10)

export const textDefaults = (overrides: Partial<TextProps> = {}): TextProps => ({
  paragraphs: plainParagraphs('Add a heading'),
  font: DEFAULT_SERIF,
  size: 40,
  color: '#121212',
  weight: 700,
  align: 'left',
  lineHeight: 1.15,
  letterSpacing: 0,
  transform: 'none',
  shadow: null,
  outline: null,
  background: null,
  curve: 0,
  autoHeight: true,
  ...overrides,
})

export const shapeDefaults = (
  kind: ShapeKind = 'rect',
  overrides: Partial<ShapeProps> = {},
): ShapeProps => ({
  kind,
  fill: kind === 'line' ? { type: 'none' } : { type: 'solid', color: '#f6f1e7' },
  stroke: kind === 'line' ? { color: '#121212', width: 2, dash: 'solid' } : null,
  radius: 0,
  points: kind === 'polygon' ? 6 : 5,
  arrowStart: false,
  arrowEnd: false,
  ...overrides,
})

export const imageDefaults = (overrides: Partial<ImageProps> = {}): ImageProps => ({
  mediaId: null,
  fit: 'cover',
  radius: 0,
  link: null,
  ...overrides,
})

export const storyDefaults = (overrides: Partial<StoryProps> = {}): StoryProps => ({
  source: 'latest',
  articleId: null,
  sectionId: null,
  index: 1,
  showImage: true,
  showKicker: true,
  showSummary: true,
  showByline: true,
  imagePosition: 'top',
  headlineSize: 24,
  font: DEFAULT_SERIF,
  color: '#121212',
  ...overrides,
})

export const listDefaults = (overrides: Partial<ListProps> = {}): ListProps => ({
  kind: 'latest',
  sectionId: null,
  count: 5,
  title: 'Latest',
  showImage: false,
  font: DEFAULT_SERIF,
  color: '#121212',
  ...overrides,
})

export const widgetDefaults = (overrides: Partial<WidgetProps> = {}): WidgetProps => ({
  kind: 'scores',
  count: 5,
  title: 'Scores',
  color: '#121212',
  ...overrides,
})

export const siteDefaults = (overrides: Partial<SiteProps> = {}): SiteProps => {
  const kind: SitePart = overrides.kind ?? 'nav'
  const looks: Record<SitePart, Partial<SiteProps>> = {
    nav: { font: DEFAULT_SANS, size: 15, align: 'center', gap: 24 },
    search: { font: DEFAULT_SANS, size: 15 },
    date: { font: DEFAULT_SANS, size: 12, weight: 700 },
    theme: { font: DEFAULT_SANS, size: 12, color: '#5a5a5a' },
    sitename: { font: 'masthead', size: 64, align: 'center', weight: 400 },
    staff: { font: DEFAULT_SANS, size: 14 },
    links: { font: DEFAULT_SANS, size: 14, gap: 22 },
    tagline: { font: DEFAULT_SANS, size: 14, color: '#5a5a5a' },
  }
  return {
    kind,
    font: DEFAULT_SANS,
    size: 15,
    color: '#121212',
    weight: 400,
    align: 'left',
    uppercase: false,
    gap: 20,
    ...looks[kind],
    ...overrides,
  }
}

export const DEFAULT_SIZES: Record<ElementType, { w: number; h: number }> = {
  text: { w: 480, h: 60 },
  shape: { w: 240, h: 160 },
  image: { w: 480, h: 320 },
  story: { w: 360, h: 380 },
  list: { w: 300, h: 360 },
  widget: { w: 300, h: 260 },
  site: { w: 600, h: 40 },
}

const base = (type: ElementType, x: number, y: number) => ({
  id: newId(),
  x,
  y,
  ...DEFAULT_SIZES[type],
  rotation: 0,
  flipX: false,
  flipY: false,
  opacity: 1,
  locked: false,
  hidden: false,
  groupId: null,
})

export const makeElement = (
  type: ElementType,
  at: { x: number; y: number },
  props: Record<string, unknown> = {},
): DesignElement => {
  switch (type) {
    case 'text':
      return { ...base(type, at.x, at.y), type, props: textDefaults(props) }
    case 'shape':
      return {
        ...base(type, at.x, at.y),
        ...(props.kind === 'line' ? { h: 20 } : {}),
        type,
        props: shapeDefaults((props.kind as ShapeKind) ?? 'rect', props),
      }
    case 'image':
      return { ...base(type, at.x, at.y), type, props: imageDefaults(props) }
    case 'story':
      return { ...base(type, at.x, at.y), type, props: storyDefaults(props) }
    case 'list':
      return { ...base(type, at.x, at.y), type, props: listDefaults(props) }
    case 'widget':
      return { ...base(type, at.x, at.y), type, props: widgetDefaults(props) }
    case 'site':
      return { ...base(type, at.x, at.y), type, props: siteDefaults(props) }
  }
}

export const emptyDesign = (): Design => ({
  version: 1,
  desktop: { height: 1600, background: { type: 'solid', color: '#ffffff' }, elements: [] },
  phone: { height: 2000, overrides: {} },
  desktopChangedAt: null,
  phoneCheckedAt: null,
})

/**
 * The current front page, recreated on the canvas: a lead story, three
 * beside it, a Latest column, and a strip per section.
 */
export const classicDesign = (sections: { id: number; name: string }[]): Design => {
  const design = emptyDesign()
  const els: DesignElement[] = []
  const place = (
    type: ElementType,
    x: number,
    y: number,
    w: number,
    h: number,
    props: Record<string, unknown>,
  ) => {
    const el = makeElement(type, { x, y }, props)
    el.w = w
    el.h = h
    els.push(el)
  }
  place('story', 0, 0, 860, 560, { index: 1, headlineSize: 40, imagePosition: 'right' })
  // A thin rule between the stories and the right-hand column.
  place('shape', 880, 0, 1, 1400, { kind: 'rect', fill: { type: 'solid', color: '#dfdfdf' } })
  place('story', 0, 600, 270, 460, { index: 2, headlineSize: 20 })
  place('story', 295, 600, 270, 460, { index: 3, headlineSize: 20 })
  place('story', 590, 600, 270, 460, { index: 4, headlineSize: 20 })
  place('list', 900, 0, 300, 700, { kind: 'latest', count: 6, title: 'Latest' })
  place('list', 900, 720, 300, 400, { kind: 'mostread', count: 5, title: 'Most read this week' })
  place('widget', 900, 1140, 300, 260, { kind: 'scores', count: 5, title: 'Scores' })
  let y = 1440
  sections.forEach((section) => {
    place('shape', 0, y, 1200, 20, {
      kind: 'line',
      stroke: { color: '#121212', width: 2, dash: 'solid' },
    })
    place('text', 0, y + 24, 600, 40, {
      paragraphs: plainParagraphs(section.name),
      font: DEFAULT_SANS,
      size: 18,
      weight: 700,
      transform: 'uppercase',
      letterSpacing: 1,
    })
    place('list', 0, y + 70, 1200, 300, {
      kind: 'section',
      sectionId: section.id,
      count: 4,
      title: '',
      showImage: true,
    })
    y += 400
  })
  design.desktop.elements = els
  design.desktop.height = Math.max(y, 1400)
  return design
}

/** Places an element at an exact spot and size. */
const at = (
  type: ElementType,
  x: number,
  y: number,
  w: number,
  h: number,
  props: Record<string, unknown>,
) => {
  const el = makeElement(type, { x, y }, props)
  el.w = w
  el.h = h
  return el
}

/** Pins an element's place on the phone canvas. */
const onPhone = (
  design: Design,
  el: DesignElement,
  x: number,
  y: number,
  w: number,
  h: number,
  hidden = false,
) => {
  design.phone.overrides[el.id] = { x, y, w, h, rotation: 0, hidden }
}

/** Today's header, recreated on the canvas. */
export const classicHeader = (): Design => {
  const design = emptyDesign()
  const date = at('site', 0, 18, 320, 18, { kind: 'date' })
  const school = at('text', 0, 38, 320, 18, {
    paragraphs: plainParagraphs('Bur Oak Secondary School'),
    font: DEFAULT_SANS,
    size: 12,
    weight: 400,
    color: '#5a5a5a',
    autoHeight: false,
  })
  const theme = at('site', 0, 60, 200, 18, { kind: 'theme' })
  const name = at('site', 300, 8, 600, 84, { kind: 'sitename' })
  const search = at('site', 960, 30, 240, 36, { kind: 'search' })
  const rule = at('shape', 0, 102, 1200, 1, {
    kind: 'rect',
    fill: { type: 'solid', color: '#dfdfdf' },
  })
  const nav = at('site', 0, 110, 1200, 34, { kind: 'nav' })
  const thick = at('shape', 0, 150, 1200, 2, {
    kind: 'rect',
    fill: { type: 'solid', color: '#121212' },
  })
  const thin = at('shape', 0, 154, 1200, 1, {
    kind: 'rect',
    fill: { type: 'solid', color: '#121212' },
  })
  design.desktop.elements = [date, school, theme, name, search, rule, nav, thick, thin]
  design.desktop.height = 160
  // On a phone: the name on top, the date and theme switch under it, then the menu.
  onPhone(design, name, 16, 8, 358, 56)
  onPhone(design, date, 16, 68, 200, 18)
  onPhone(design, theme, 230, 68, 144, 18)
  onPhone(design, school, 16, 88, 358, 18, true)
  onPhone(design, search, 16, 92, 358, 36, true)
  onPhone(design, rule, 0, 94, 390, 1)
  onPhone(design, nav, 16, 100, 358, 36)
  onPhone(design, thick, 0, 142, 390, 2)
  onPhone(design, thin, 0, 146, 390, 1)
  design.phoneCheckedAt = new Date().toISOString()
  return design
}

/** Today's footer, recreated on the canvas. */
export const classicFooter = (): Design => {
  const design = emptyDesign()
  const thick = at('shape', 0, 0, 1200, 2, {
    kind: 'rect',
    fill: { type: 'solid', color: '#121212' },
  })
  const thin = at('shape', 0, 4, 1200, 1, {
    kind: 'rect',
    fill: { type: 'solid', color: '#121212' },
  })
  const name = at('site', 0, 24, 300, 44, { kind: 'sitename', size: 30, align: 'left' })
  const links = at('site', 0, 80, 1200, 30, { kind: 'links' })
  const tagline = at('site', 0, 120, 1200, 24, { kind: 'tagline' })
  design.desktop.elements = [thick, thin, name, links, tagline]
  design.desktop.height = 170
  return design
}

/** A new custom page: its title and a paragraph to replace. */
export const pageStarter = (title: string): Design => {
  const design = emptyDesign()
  design.desktop.height = 900
  design.desktop.elements = [
    at('text', 160, 80, 880, 80, {
      paragraphs: plainParagraphs(title),
      size: 56,
      align: 'center',
    }),
    at('text', 260, 200, 680, 120, {
      paragraphs: plainParagraphs(
        'Write something here, or add pictures, shapes and stories from the toolbar.',
      ),
      font: DEFAULT_SERIF,
      size: 20,
      weight: 400,
      lineHeight: 1.5,
      align: 'center',
    }),
  ]
  return design
}
