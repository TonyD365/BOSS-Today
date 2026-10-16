import type { Color, Fill } from './types'

/** Quick-pick colours: the newspaper's own, then a few classics. */
export const NEWSPAPER_COLORS: { name: string; color: Color }[] = [
  { name: 'Ink', color: '#121212' },
  { name: 'Soft ink', color: '#363636' },
  { name: 'Grey', color: '#5a5a5a' },
  { name: 'Rule', color: '#dfdfdf' },
  { name: 'Paper', color: '#ffffff' },
  { name: 'Newsprint', color: '#f6f1e7' },
  { name: 'Link blue', color: '#326891' },
  { name: 'Navy', color: '#1f3a5f' },
  { name: 'Forest', color: '#2f5d46' },
  { name: 'Oak gold', color: '#c9a227' },
  { name: 'Alert red', color: '#b3261e' },
  { name: 'Plum', color: '#5b2a6e' },
]

export const isColor = (value: unknown): value is Color =>
  typeof value === 'string' && /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)

const channels = (color: Color) => {
  const hex = color.slice(1)
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
    a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
  }
}

const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b]
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`

/** A colour with transparency, as it looks over a background. */
export const flatten = (color: Color, over: Color = '#ffffff'): Color => {
  const top = channels(color)
  const bottom = channels(over)
  const mix = (a: number, b: number) => a * top.a + b * (1 - top.a)
  return toHex(mix(top.r, bottom.r), mix(top.g, bottom.g), mix(top.b, bottom.b))
}

const luminance = (color: Color) => {
  const { r, g, b } = channels(color)
  const lin = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** WCAG contrast ratio, 1 to 21. */
export const contrast = (a: Color, b: Color) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Large text (24px, or 19px bold) needs 3:1; everything else 4.5:1. */
export const requiredContrast = (size: number, bold: boolean) =>
  size >= 24 || (bold && size >= 18.66) ? 3 : 4.5

/** The nearest colour, darker or lighter, that is readable on the background. */
export const readableNear = (color: Color, background: Color, needed: number): Color => {
  const start = channels(flatten(color, background))
  for (let step = 1; step <= 20; step++) {
    for (const target of [0, 255]) {
      const t = step / 20
      const candidate = toHex(
        start.r + (target - start.r) * t,
        start.g + (target - start.g) * t,
        start.b + (target - start.b) * t,
      )
      if (contrast(candidate, background) >= needed) return candidate
    }
  }
  return contrast('#000000', background) >= contrast('#ffffff', background) ? '#000000' : '#ffffff'
}

/** One colour that stands for a fill when checking contrast (gradients average their stops). */
export const representative = (fill: Fill, over: Color = '#ffffff'): Color | null => {
  if (fill.type === 'solid') return flatten(fill.color, over)
  if (fill.type === 'linear' && fill.stops.length > 0) {
    const all = fill.stops.map((stop) => channels(flatten(stop.color, over)))
    const avg = (key: 'r' | 'g' | 'b') => all.reduce((sum, c) => sum + c[key], 0) / all.length
    return toHex(avg('r'), avg('g'), avg('b'))
  }
  return null
}

/** CSS for a fill. */
export const fillCss = (fill: Fill): string => {
  if (fill.type === 'solid') return fill.color
  if (fill.type === 'linear') {
    const stops = [...fill.stops]
      .sort((a, b) => a.at - b.at)
      .map((stop) => `${stop.color} ${Math.round(stop.at * 100)}%`)
      .join(', ')
    return `linear-gradient(${fill.angle}deg, ${stops})`
  }
  return 'transparent'
}
