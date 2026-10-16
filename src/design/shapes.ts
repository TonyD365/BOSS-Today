import type { ShapeProps } from './types'

const round = (n: number) => Math.round(n * 100) / 100

const polygon = (points: [number, number][]) =>
  `M${points.map(([x, y]) => `${round(x)},${round(y)}`).join(' L')} Z`

/** An SVG path for a shape filling a w × h box (lines are drawn separately). */
export const shapePath = (
  props: Pick<ShapeProps, 'kind' | 'radius' | 'points'>,
  w: number,
  h: number,
) => {
  const r = Math.max(0, Math.min(props.radius, w / 2, h / 2))
  switch (props.kind) {
    case 'rect':
      return r > 0
        ? `M${r},0 H${w - r} A${r},${r} 0 0 1 ${w},${r} V${h - r} A${r},${r} 0 0 1 ${w - r},${h} H${r} A${r},${r} 0 0 1 0,${h - r} V${r} A${r},${r} 0 0 1 ${r},0 Z`
        : `M0,0 H${w} V${h} H0 Z`
    case 'ellipse':
      return `M${w / 2},0 A${w / 2},${h / 2} 0 1 1 ${w / 2},${h} A${w / 2},${h / 2} 0 1 1 ${w / 2},0 Z`
    case 'triangle':
      return polygon([
        [w / 2, 0],
        [w, h],
        [0, h],
      ])
    case 'star': {
      const n = Math.max(3, Math.min(props.points, 12))
      const pts: [number, number][] = []
      for (let i = 0; i < n * 2; i++) {
        const angle = (Math.PI * i) / n - Math.PI / 2
        const k = i % 2 === 0 ? 1 : 0.45
        pts.push([w / 2 + (Math.cos(angle) * w * k) / 2, h / 2 + (Math.sin(angle) * h * k) / 2])
      }
      return polygon(pts)
    }
    case 'polygon': {
      const n = Math.max(3, Math.min(props.points, 12))
      const pts: [number, number][] = []
      for (let i = 0; i < n; i++) {
        const angle = (2 * Math.PI * i) / n - Math.PI / 2
        pts.push([w / 2 + (Math.cos(angle) * w) / 2, h / 2 + (Math.sin(angle) * h) / 2])
      }
      return polygon(pts)
    }
    case 'arrow': {
      const shaft = h * 0.36
      const head = Math.min(w * 0.45, h)
      return polygon([
        [0, (h - shaft) / 2],
        [w - head, (h - shaft) / 2],
        [w - head, 0],
        [w, h / 2],
        [w - head, h],
        [w - head, (h + shaft) / 2],
        [0, (h + shaft) / 2],
      ])
    }
    case 'bubble': {
      const tail = Math.min(h * 0.22, 40)
      const body = h - tail
      const rr = Math.min(r || 16, w / 2, body / 2)
      return `M${rr},0 H${w - rr} A${rr},${rr} 0 0 1 ${w},${rr} V${body - rr} A${rr},${rr} 0 0 1 ${w - rr},${body} H${w * 0.36} L${w * 0.22},${h} L${w * 0.24},${body} H${rr} A${rr},${rr} 0 0 1 0,${body - rr} V${rr} A${rr},${rr} 0 0 1 ${rr},0 Z`
    }
    default:
      return ''
  }
}

export const dashArray = (dash: 'solid' | 'dashed' | 'dotted', width: number) =>
  dash === 'dashed' ? `${width * 3} ${width * 2}` : dash === 'dotted' ? `0 ${width * 2}` : undefined
