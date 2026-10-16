import React from 'react'

import { fillCss } from './color'
import { fontFamily } from './fonts'
import { phoneHeight, phoneLayout } from './phone'
import { dashArray, shapePath } from './shapes'
import {
  type Design,
  type DesignElement,
  DESKTOP_WIDTH,
  type Fill,
  type Geometry,
  type Paragraph,
  PHONE_WIDTH,
  type Run,
} from './types'

/**
 * Draws a design. The same components render the public front page (static
 * HTML, scaled with container units) and the designer's canvas (at a zoom),
 * so what the editor shows is what readers get. Pure: no hooks, no browser APIs.
 */

export type DImage = { url: string; alt: string; width?: number | null; height?: number | null }
export type DArticle = {
  id: number
  title: string
  slug: string
  summary: string | null
  section: { id: number; name: string; slug: string } | null
  authors: string[]
  image: DImage | null
}

export type DesignData = {
  /** Published stories, newest first. */
  articles: DArticle[]
  /** Any story a card may name, published or waiting for the next issue. */
  byId: Record<number, DArticle>
  media: Record<number, DImage>
  issue: { title: string; label: string; href: string } | null
  /** Designer only: live data to show in place of what the site fills in later. */
  preview?: {
    mostRead: { title: string; url: string; section: string | null }[]
    scores: string[]
    events: string[]
    live: string[]
  }
}

type View = 'desktop' | 'phone'

const u = (n: number) => `calc(${Math.round(n * 100) / 100} * var(--u))`

/** The story a card shows. A named story that isn't public falls back to the newest. */
export const resolveStory = (
  el: Extract<DesignElement, { type: 'story' }>,
  data: DesignData,
  publicOnly: boolean,
): DArticle | null => {
  const { props } = el
  if (props.source === 'pick' && props.articleId) {
    const picked = publicOnly
      ? data.articles.find((a) => a.id === props.articleId)
      : data.byId[props.articleId]
    if (picked) return picked
    return data.articles[0] ?? null
  }
  const pool =
    props.source === 'section'
      ? data.articles.filter((a) => a.section?.id === props.sectionId)
      : data.articles
  return pool[props.index - 1] ?? null
}

const runStyle = (run: Run): React.CSSProperties => ({
  fontWeight: run.bold === undefined ? undefined : run.bold ? 700 : 400,
  fontStyle: run.italic ? 'italic' : undefined,
  textDecoration:
    [run.underline && 'underline', run.strike && 'line-through'].filter(Boolean).join(' ') ||
    undefined,
  color: run.color,
  fontSize: run.size ? `calc(${run.size} * var(--fs, 1) * var(--u))` : undefined,
})

export function Runs({ runs }: { runs: Run[] }) {
  return (
    <>
      {runs.map((run, i) =>
        run.text ? (
          <span key={i} style={runStyle(run)}>
            {run.text}
          </span>
        ) : null,
      )}
    </>
  )
}

/** Paragraphs, with neighbouring list items grouped into lists. */
export function Paragraphs({ paragraphs }: { paragraphs: Paragraph[] }) {
  const blocks: React.ReactNode[] = []
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i]
    if (p.list) {
      const items: Paragraph[] = []
      while (i < paragraphs.length && paragraphs[i].list === p.list) items.push(paragraphs[i++])
      i--
      const List = p.list === 'number' ? 'ol' : 'ul'
      blocks.push(
        <List key={i}>
          {items.map((item, j) => (
            <li key={j}>
              <Runs runs={item.runs} />
            </li>
          ))}
        </List>,
      )
    } else {
      blocks.push(<p key={i}>{p.runs.some((r) => r.text) ? <Runs runs={p.runs} /> : <br />}</p>)
    }
  }
  return <>{blocks}</>
}

function TextElement({ el, g }: { el: Extract<DesignElement, { type: 'text' }>; g: Geometry }) {
  const p = el.props
  const style: React.CSSProperties = {
    fontFamily: fontFamily(p.font),
    fontSize: `calc(${p.size} * var(--fs, 1) * var(--u))`,
    color: p.color,
    fontWeight: p.weight,
    textAlign: p.align,
    lineHeight: p.lineHeight,
    letterSpacing: u(p.letterSpacing),
    textTransform: p.transform === 'none' ? undefined : p.transform,
    textShadow: p.shadow
      ? `${u(p.shadow.x)} ${u(p.shadow.y)} ${u(p.shadow.blur)} ${p.shadow.color}`
      : undefined,
    WebkitTextStroke: p.outline ? `${u(p.outline.width)} ${p.outline.color}` : undefined,
    paintOrder: p.outline ? 'stroke fill' : undefined,
    background: p.background?.color,
    padding: p.background ? u(p.background.padding) : undefined,
    borderRadius: p.background ? u(p.background.radius) : undefined,
  }
  if (p.curve !== 0) {
    // One line of text along an arc that fits the box.
    const w = g.w
    const h = g.h
    const bend = (p.curve / 100) * h * 0.9
    const path = `M0,${h / 2 + bend / 2} Q${w / 2},${h / 2 - bend * 1.5} ${w},${h / 2 + bend / 2}`
    const pathId = `curve-${el.id}`
    const runs = p.paragraphs.flatMap((para) => para.runs)
    return (
      <div className="dc-text" style={{ ...style, padding: 0 }}>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          width="100%"
          height="100%"
          aria-label={runs.map((r) => r.text).join('')}
        >
          <defs>
            <path id={pathId} d={path} />
          </defs>
          <text
            fontSize={p.size * (g.fontScale ?? 1)}
            fill={p.color}
            textAnchor="middle"
            style={{ fontFamily: fontFamily(p.font), fontWeight: p.weight }}
          >
            <textPath href={`#${pathId}`} startOffset="50%">
              {runs.map((run, i) => (
                <tspan
                  key={i}
                  fill={run.color}
                  fontWeight={run.bold === undefined ? undefined : run.bold ? 700 : 400}
                  fontStyle={run.italic ? 'italic' : undefined}
                  fontSize={run.size ? run.size * (g.fontScale ?? 1) : undefined}
                >
                  {p.transform === 'uppercase'
                    ? run.text.toUpperCase()
                    : p.transform === 'lowercase'
                      ? run.text.toLowerCase()
                      : run.text}
                </tspan>
              ))}
            </textPath>
          </text>
        </svg>
      </div>
    )
  }
  return (
    <div className="dc-text" style={style}>
      <Paragraphs paragraphs={p.paragraphs} />
    </div>
  )
}

function gradientDef(fill: Fill, id: string) {
  if (fill.type !== 'linear') return null
  const rad = ((fill.angle - 90) * Math.PI) / 180
  const x = Math.cos(rad) / 2
  const y = Math.sin(rad) / 2
  return (
    <linearGradient id={id} x1={0.5 - x} y1={0.5 - y} x2={0.5 + x} y2={0.5 + y}>
      {[...fill.stops]
        .sort((a, b) => a.at - b.at)
        .map((stop, i) => (
          <stop key={i} offset={stop.at} stopColor={stop.color} />
        ))}
    </linearGradient>
  )
}

function ShapeElement({ el, g }: { el: Extract<DesignElement, { type: 'shape' }>; g: Geometry }) {
  const p = el.props
  const w = Math.max(g.w, 1)
  const h = Math.max(g.h, 1)
  const gradientId = `grad-${el.id}`
  const fill =
    p.fill.type === 'solid'
      ? p.fill.color
      : p.fill.type === 'linear'
        ? `url(#${gradientId})`
        : 'none'
  const stroke = p.stroke
  if (p.kind === 'line') {
    const markerId = `arrow-${el.id}`
    const sw = stroke?.width ?? 2
    return (
      <svg
        className="dc-shape"
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        height="100%"
        aria-hidden="true"
      >
        <defs>
          <marker
            id={markerId}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 Z" fill={stroke?.color ?? '#121212'} />
          </marker>
        </defs>
        <line
          x1={p.arrowStart ? sw * 2 : 0}
          y1={h / 2}
          x2={p.arrowEnd ? w - sw * 2 : w}
          y2={h / 2}
          stroke={stroke?.color ?? '#121212'}
          strokeWidth={sw}
          strokeDasharray={stroke ? dashArray(stroke.dash, sw) : undefined}
          strokeLinecap={stroke?.dash === 'dotted' ? 'round' : 'butt'}
          markerStart={p.arrowStart ? `url(#${markerId})` : undefined}
          markerEnd={p.arrowEnd ? `url(#${markerId})` : undefined}
        />
      </svg>
    )
  }
  // Rectangles are plain boxes, so gradients and rounded corners stay crisp at any size.
  if (p.kind === 'rect') {
    return (
      <div
        className="dc-shape"
        style={{
          width: '100%',
          height: '100%',
          background: fillCss(p.fill),
          borderRadius: u(p.radius),
          border: stroke ? `${u(stroke.width)} ${stroke.dash} ${stroke.color}` : undefined,
          boxSizing: 'border-box',
        }}
      />
    )
  }
  const sw = stroke?.width ?? 0
  return (
    <svg
      className="dc-shape"
      viewBox={`${-sw / 2} ${-sw / 2} ${w + sw} ${h + sw}`}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>{gradientDef(p.fill, gradientId)}</defs>
      <path
        d={shapePath(p, w, h)}
        fill={fill}
        stroke={stroke?.color ?? 'none'}
        strokeWidth={sw || undefined}
        strokeDasharray={stroke ? dashArray(stroke.dash, sw) : undefined}
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ImageElement({
  el,
  data,
}: {
  el: Extract<DesignElement, { type: 'image' }>
  data: DesignData
}) {
  const p = el.props
  const media = p.mediaId ? data.media[p.mediaId] : undefined
  const img = media ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={media.url}
      alt={media.alt}
      loading="lazy"
      style={{ objectFit: p.fit, borderRadius: u(p.radius) }}
    />
  ) : (
    <div className="dc-image__empty" style={{ borderRadius: u(p.radius) }}>
      Choose an image
    </div>
  )
  return <div className="dc-image">{p.link && media ? <a href={p.link}>{img}</a> : img}</div>
}

function StoryElement({
  el,
  data,
  publicOnly,
}: {
  el: Extract<DesignElement, { type: 'story' }>
  data: DesignData
  publicOnly: boolean
}) {
  const p = el.props
  const story = resolveStory(el, data, publicOnly)
  if (!story) return <div className="dc-empty">No story yet</div>
  const image = p.showImage ? story.image : null
  return (
    <a
      className={`dc-story dc-story--${image ? p.imagePosition : 'none'}`}
      href={`/article/${story.slug}/`}
      style={{ fontFamily: fontFamily(p.font), color: p.color }}
    >
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="dc-story__image" src={image.url} alt={image.alt} loading="lazy" />
      )}
      <span className="dc-story__text">
        {p.showKicker && story.section && <span className="dc-kicker">{story.section.name}</span>}
        <span
          className="dc-story__headline"
          style={{ fontSize: `calc(${p.headlineSize} * var(--fs, 1) * var(--u))` }}
        >
          {story.title}
        </span>
        {p.showSummary && story.summary && (
          <span className="dc-story__summary">{story.summary}</span>
        )}
        {p.showByline && story.authors.length > 0 && (
          <span className="dc-byline">By {story.authors.join(', ')}</span>
        )}
      </span>
    </a>
  )
}

function ListElement({
  el,
  data,
}: {
  el: Extract<DesignElement, { type: 'list' }>
  data: DesignData
}) {
  const p = el.props
  const style = { fontFamily: fontFamily(p.font), color: p.color }
  if (p.kind === 'mostread') {
    // The site fills this in from /api/live; the designer shows current figures.
    const items = data.preview?.mostRead ?? []
    return (
      <div className="dc-list" style={style} data-most-read="" data-count={p.count}>
        {p.title && <p className="dc-list__title">{p.title}</p>}
        <ol className="dc-list__items dc-list__items--ranked">
          {items.slice(0, p.count).map((item, i) => (
            <li key={i}>
              <a href={item.url}>{item.title}</a>
            </li>
          ))}
        </ol>
      </div>
    )
  }
  const items = (
    p.kind === 'section'
      ? data.articles.filter((a) => a.section?.id === p.sectionId)
      : data.articles
  ).slice(0, p.count)
  return (
    <div className={`dc-list${p.showImage ? ' dc-list--images' : ''}`} style={style}>
      {p.title && <p className="dc-list__title">{p.title}</p>}
      <ul className="dc-list__items">
        {items.map((story) => (
          <li key={story.id}>
            <a href={`/article/${story.slug}/`}>
              {p.showImage && story.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={story.image.url} alt="" loading="lazy" />
              )}
              <span>{story.title}</span>
            </a>
          </li>
        ))}
        {items.length === 0 && <li className="dc-empty">No stories yet</li>}
      </ul>
    </div>
  )
}

function WidgetElement({
  el,
  data,
}: {
  el: Extract<DesignElement, { type: 'widget' }>
  data: DesignData
}) {
  const p = el.props
  if (p.kind === 'issue') {
    return (
      <div className="dc-widget" style={{ color: p.color }}>
        {p.title && <p className="dc-list__title">{p.title}</p>}
        {data.issue ? (
          <a className="dc-issue" href={data.issue.href}>
            <span className="dc-kicker">{data.issue.label}</span>
            <span className="dc-story__headline">{data.issue.title}</span>
          </a>
        ) : (
          <p className="dc-empty">No issue yet</p>
        )}
      </div>
    )
  }
  const sample = data.preview?.[p.kind] ?? []
  if (p.kind === 'live') {
    return (
      <div className="dc-widget dc-widget--live" style={{ color: p.color }} data-board="live">
        {sample.slice(0, 1).map((title, i) => (
          <a key={i} href="/live/">
            <span className="live-badge">LIVE</span> {title}
          </a>
        ))}
      </div>
    )
  }
  return (
    <div className="dc-widget" style={{ color: p.color }} data-board={p.kind} data-count={p.count}>
      {p.title && (
        <p className="dc-list__title">
          <a href={p.kind === 'scores' ? '/scores/' : '/calendar/'}>{p.title}</a>
        </p>
      )}
      <ul className="dc-list__items">
        {sample.slice(0, p.count).map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </div>
  )
}

export function ElementContent({
  el,
  g,
  data,
  publicOnly,
}: {
  el: DesignElement
  g: Geometry
  data: DesignData
  publicOnly: boolean
}) {
  switch (el.type) {
    case 'text':
      return <TextElement el={el} g={g} />
    case 'shape':
      return <ShapeElement el={el} g={g} />
    case 'image':
      return <ImageElement el={el} data={data} />
    case 'story':
      return <StoryElement el={el} data={data} publicOnly={publicOnly} />
    case 'list':
      return <ListElement el={el} data={data} />
    case 'widget':
      return <WidgetElement el={el} data={data} />
  }
}

/** Position, rotation, flip and opacity for an element box. */
export const boxStyle = (el: DesignElement, g: Geometry, z: number): React.CSSProperties => {
  const transforms = [
    g.rotation ? `rotate(${g.rotation}deg)` : '',
    el.flipX || el.flipY ? `scale(${el.flipX ? -1 : 1}, ${el.flipY ? -1 : 1})` : '',
  ].filter(Boolean)
  return {
    left: u(g.x),
    top: u(g.y),
    width: u(g.w),
    height: u(g.h),
    transform: transforms.length ? transforms.join(' ') : undefined,
    opacity: el.opacity < 1 ? el.opacity : undefined,
    zIndex: z,
    ['--fs' as string]: g.fontScale ?? 1,
  }
}

export const geometryFor = (design: Design, view: View) => {
  if (view === 'desktop')
    return new Map(design.desktop.elements.map((el) => [el.id, el as Geometry]))
  return phoneLayout(design)
}

export const canvasSize = (design: Design, view: View, geometry = geometryFor(design, view)) =>
  view === 'desktop'
    ? { width: DESKTOP_WIDTH, height: design.desktop.height }
    : { width: PHONE_WIDTH, height: phoneHeight(design, geometry) }

/**
 * A whole canvas. On the site, `unit` is left out and the canvas scales to its
 * container; the designer passes a pixel unit for its zoom level.
 */
export function DesignCanvas({
  design,
  view,
  data,
  unit,
  publicOnly = true,
  renderElement,
}: {
  design: Design
  view: View
  data: DesignData
  unit?: number
  publicOnly?: boolean
  /** The designer wraps each element to make it selectable. */
  renderElement?: (
    el: DesignElement,
    g: Geometry,
    z: number,
    content: React.ReactNode,
  ) => React.ReactNode
}) {
  const geometry = geometryFor(design, view)
  const size = canvasSize(design, view, geometry)
  return (
    <div
      className={`dc dc--${view}`}
      style={{
        ['--u' as string]: unit ? `${unit}px` : `calc(100cqw / ${size.width})`,
        aspectRatio: `${size.width} / ${size.height}`,
        width: unit ? size.width * unit : '100%',
        background: fillCss(design.desktop.background),
      }}
    >
      {design.desktop.elements.map((el, z) => {
        const g = geometry.get(el.id)
        if (!g || (el.hidden && !renderElement) || (g.hidden && !renderElement)) return null
        const content = <ElementContent el={el} g={g} data={data} publicOnly={publicOnly} />
        if (renderElement)
          return <React.Fragment key={el.id}>{renderElement(el, g, z, content)}</React.Fragment>
        return (
          <div key={el.id} className={`dc-el dc-el--${el.type}`} style={boxStyle(el, g, z)}>
            {content}
          </div>
        )
      })}
    </div>
  )
}

/** The public front page: desktop canvas, and the phone canvas on small screens. */
export function DesignedHome({ design, data }: { design: Design; data: DesignData }) {
  return (
    <div className="dc-home">
      <div className="dc-wrap dc-wrap--desktop">
        <DesignCanvas design={design} view="desktop" data={data} />
      </div>
      <div className="dc-wrap dc-wrap--phone">
        <DesignCanvas design={design} view="phone" data={data} />
      </div>
    </div>
  )
}

/** Fonts a design uses, for loading them on the page. */
export const designFonts = (design: Design) => {
  const fonts = new Set<string>()
  for (const el of design.desktop.elements) {
    if ('font' in el.props && typeof el.props.font === 'string') fonts.add(el.props.font)
  }
  return fonts
}
