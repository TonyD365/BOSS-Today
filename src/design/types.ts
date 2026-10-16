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

export type ImageProps = {
  mediaId: number | null
  fit: 'cover' | 'contain'
  radius: number
  link: string | null
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

export type ElementType = DesignElement['type']

export type Geometry = Pick<Base, 'x' | 'y' | 'w' | 'h' | 'rotation' | 'hidden'> & {
  /** Phone only: shrinks text that would be too big on a small screen. */
  fontScale?: number
}

export type Design = {
  version: 1
  desktop: { height: number; background: Fill; elements: DesignElement[] }
  /** Phone geometry per element id; elements without one are laid out automatically. */
  phone: { height: number; overrides: Record<string, Geometry & { auto?: boolean }> }
  desktopChangedAt: string | null
  phoneCheckedAt: string | null
}
