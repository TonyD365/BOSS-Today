/**
 * A site design: a free canvas for the front page, Canva-style. Elements sit
 * at absolute positions on a 1200-wide desktop canvas that scales with the
 * screen; phones get their own canvas (geometry overrides, see phone.ts).
 * Elements are listed bottom to top.
 */
export const DESKTOP_WIDTH = 1200
export const PHONE_WIDTH = 390

export type Color = string // #rrggbb or #rrggbbaa

export type Fill =
  | { type: 'none' }
  | { type: 'solid'; color: Color }
  | { type: 'linear'; angle: number; stops: { color: Color; at: number }[] }

export type Run = {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  color?: Color
  size?: number
}

export type Paragraph = {
  runs: Run[]
  list?: 'bullet' | 'number'
}

export type TextProps = {
  paragraphs: Paragraph[]
  font: string
  size: number
  color: Color
  weight: 400 | 700
  align: 'left' | 'center' | 'right' | 'justify'
  lineHeight: number
  letterSpacing: number
  transform: 'none' | 'uppercase' | 'lowercase'
  shadow: { x: number; y: number; blur: number; color: Color } | null
  outline: { width: number; color: Color } | null
  background: { color: Color; padding: number; radius: number } | null
  /** -100..100: bends a single line of text into an arc. */
  curve: number
  autoHeight: boolean
}

export const SHAPES = [
  'rect',
  'ellipse',
  'triangle',
  'star',
  'arrow',
  'bubble',
  'polygon',
  'line',
] as const
export type ShapeKind = (typeof SHAPES)[number]

export type ShapeProps = {
  kind: ShapeKind
  fill: Fill
  stroke: { color: Color; width: number; dash: 'solid' | 'dashed' | 'dotted' } | null
  radius: number
  /** Star points or polygon sides. */
  points: number
  arrowStart: boolean
  arrowEnd: boolean
}

export const IMAGE_MASKS = [
  'none',
  'circle',
  'ellipse',
  'triangle',
  'hexagon',
  'star',
  'arch',
] as const
export type ImageMask = (typeof IMAGE_MASKS)[number]

export type ImageProps = {
  mediaId: number | null
  fit: 'cover' | 'contain'
  radius: number
  link: string | null
  /** Which part of the photo shows: a point to zoom in on (0–100 each way) and how far. */
  crop: { x: number; y: number; zoom: number }
  mask: ImageMask
  /** Percentages (blur in design pixels); 100 means unchanged for the first three. */
  filters: {
    brightness: number
    contrast: number
    saturate: number
    grayscale: number
    sepia: number
    blur: number
  }
  shadow: boolean
  border: { color: Color; width: number } | null
}

/** An icon's drawing (24×24, stroked); a path given as [d, 1] is filled instead. */
export type IconPath = string | [string, 1]
export type IconProps = {
  name: string
  paths: IconPath[]
  color: Color
  strokeWidth: number
}

/** A simple table: scores, line-ups, results. The first row can be a header. */
export type TableProps = {
  rows: string[][]
  header: boolean
  font: string
  size: number
  color: Color
  fill: Color | null
  headerFill: Color
  headerColor: Color
  lines: Color
  stripes: boolean
  align: 'left' | 'center'
}

export type StoryProps = {
  source: 'pick' | 'latest' | 'section'
  articleId: number | null
  sectionId: number | null
  /** 1 = newest. */
  index: number
  showImage: boolean
  showKicker: boolean
  showSummary: boolean
  showByline: boolean
  imagePosition: 'top' | 'left' | 'right'
  headlineSize: number
  font: string
  color: Color
}

export type ListProps = {
  kind: 'latest' | 'mostread' | 'section'
  sectionId: number | null
  count: number
  title: string
  showImage: boolean
  font: string
  color: Color
}

export type WidgetProps = {
  kind: 'scores' | 'events' | 'live' | 'issue'
  count: number
  title: string
  color: Color
}

/**
 * Parts of the site itself, for the header, footer and pages: the section
 * navigation, search, today's date, the theme switch, the paper's name, the
 * staff sign-in link, the footer's links and the tagline.
 */
export const SITE_PARTS = [
  'nav',
  'search',
  'date',
  'theme',
  'sitename',
  'staff',
  'links',
  'tagline',
] as const
export type SitePart = (typeof SITE_PARTS)[number]

export type SiteProps = {
  kind: SitePart
  font: string
  size: number
  color: Color
  weight: 400 | 700
  align: 'left' | 'center' | 'right'
  uppercase: boolean
  /** Space between links, for navigation and link lists. */
  gap: number
}

type Base = {
  id: string
  name?: string
  x: number
  y: number
  w: number
  h: number
  rotation: number
  flipX: boolean
  flipY: boolean
  opacity: number
  locked: boolean
  hidden: boolean
  groupId: string | null
}

export type DesignElement =
  | (Base & { type: 'text'; props: TextProps })
  | (Base & { type: 'shape'; props: ShapeProps })
  | (Base & { type: 'image'; props: ImageProps })
  | (Base & { type: 'story'; props: StoryProps })
  | (Base & { type: 'list'; props: ListProps })
  | (Base & { type: 'widget'; props: WidgetProps })
  | (Base & { type: 'site'; props: SiteProps })
  | (Base & { type: 'icon'; props: IconProps })
  | (Base & { type: 'table'; props: TableProps })

export type ElementType = DesignElement['type']

export type Geometry = Pick<Base, 'x' | 'y' | 'w' | 'h' | 'rotation' | 'hidden'> & {
  /** Phone only: shrinks text that would be too big on a small screen. */
  fontScale?: number
}

export type Design = {
  version: 1
  /** width is only set for narrow canvases, like a template's sidebar (default DESKTOP_WIDTH). */
  desktop: { width?: number; height: number; background: Fill; elements: DesignElement[] }
  /** Phone geometry per element id; elements without one are laid out automatically. */
  phone: { height: number; overrides: Record<string, Geometry & { auto?: boolean }> }
  desktopChangedAt: string | null
  phoneCheckedAt: string | null
  /** Designer only: guide lines dragged from the rulers (desktop canvas). */
  guides?: { x: number[]; y: number[] }
}

/** Pages whose content is filled in automatically; each kind shares one template. */
export const TEMPLATE_KINDS = ['article', 'section', 'tag', 'author', 'issue', 'other'] as const
export type TemplateKind = (typeof TEMPLATE_KINDS)[number]
export const TEMPLATE_SLOTS = ['above', 'side', 'below'] as const
export type TemplateSlot = (typeof TEMPLATE_SLOTS)[number]
/** Parts of a story page that can be left out. */
export const ARTICLE_PARTS = ['summary', 'byline', 'reading', 'share', 'tags', 'authors'] as const
export type ArticlePart = (typeof ARTICLE_PARTS)[number]
export const SIDE_WIDTH = 300

/**
 * A page template: canvases above, beside and below content that is laid out
 * automatically (so a long story is never cut off), and how that content looks.
 */
export type PageTemplate = {
  above: Design | null
  side: Design | null
  below: Design | null
  sidePosition: 'right' | 'left'
  width: 'narrow' | 'medium' | 'wide'
  align: 'center' | 'left'
  headFont: string | null
  bodyFont: string | null
  /** Story pages only. */
  hide: ArticlePart[]
  imageFirst: boolean
}
export type Templates = Partial<Record<TemplateKind, PageTemplate>>
