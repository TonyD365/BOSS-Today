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

export const DEFAULT_SIZES: Record<ElementType, { w: number; h: number }> = {
  text: { w: 480, h: 60 },
  shape: { w: 240, h: 160 },
  image: { w: 480, h: 320 },
  story: { w: 360, h: 380 },
  list: { w: 300, h: 360 },
  widget: { w: 300, h: 260 },
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
