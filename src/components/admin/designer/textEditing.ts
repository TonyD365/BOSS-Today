import { tidyRuns } from '@/design/richtext'
import type { Paragraph, Run } from '@/design/types'

/**
 * Inline text editing uses a contentEditable box styled like the element.
 * Font sizes are written in screen pixels (design size × zoom) and read back
 * the same way.
 */
const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )

const runHtml = (run: Run, zoom: number) => {
  const styles = [
    run.bold !== undefined ? `font-weight:${run.bold ? 700 : 400}` : '',
    run.italic ? 'font-style:italic' : '',
    run.underline || run.strike
      ? `text-decoration:${[run.underline && 'underline', run.strike && 'line-through'].filter(Boolean).join(' ')}`
      : '',
    run.color ? `color:${run.color}` : '',
    run.size ? `font-size:${run.size * zoom}px` : '',
  ].filter(Boolean)
  const text = escapeHtml(run.text)
  return styles.length ? `<span style="${styles.join(';')}">${text}</span>` : text
}

export const paragraphsToHtml = (paragraphs: Paragraph[], zoom: number) => {
  const html: string[] = []
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i]
    const inner = (para: Paragraph) => para.runs.map((r) => runHtml(r, zoom)).join('') || '<br>'
    if (p.list) {
      const tag = p.list === 'number' ? 'ol' : 'ul'
      const items: string[] = []
      while (i < paragraphs.length && paragraphs[i].list === p.list)
        items.push(`<li>${inner(paragraphs[i++])}</li>`)
      i--
      html.push(`<${tag}>${items.join('')}</${tag}>`)
    } else {
      html.push(`<div>${inner(p)}</div>`)
    }
  }
  return html.join('')
}

const toHex = (value: string) => {
  const m = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (m)
    return `#${[m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('')}`
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase()
  if (/^#[0-9a-f]{3}$/i.test(value))
    return `#${value.slice(1).replace(/./g, (c) => c + c)}`.toLowerCase()
  return undefined
}

type Style = Omit<Run, 'text'>

const styleOf = (el: HTMLElement, parent: Style, zoom: number): Style => {
  const style: Style = { ...parent }
  const tag = el.tagName
  if (tag === 'B' || tag === 'STRONG') style.bold = true
  if (tag === 'I' || tag === 'EM') style.italic = true
  if (tag === 'U') style.underline = true
  if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') style.strike = true
  if (tag === 'FONT' && el.getAttribute('color')) style.color = toHex(el.getAttribute('color')!)
  const s = el.style
  if (s.fontWeight) style.bold = s.fontWeight === 'bold' || Number(s.fontWeight) >= 600
  if (s.fontStyle) style.italic = s.fontStyle === 'italic'
  const deco = s.textDecorationLine || s.textDecoration
  if (deco) {
    style.underline = deco.includes('underline')
    style.strike = deco.includes('line-through')
  }
  if (s.color) style.color = toHex(s.color) ?? style.color
  if (s.fontSize && s.fontSize.endsWith('px')) {
    const px = parseFloat(s.fontSize) / zoom
    if (px >= 6 && px <= 300) style.size = Math.round(px)
  }
  return style
}

const BLOCKS = new Set(['DIV', 'P', 'LI', 'H1', 'H2', 'H3', 'H4', 'BLOCKQUOTE'])

/** Reads the edited box back into paragraphs. */
export const htmlToParagraphs = (root: HTMLElement, zoom: number): Paragraph[] => {
  const paragraphs: Paragraph[] = []
  let current: Paragraph | null = null
  const start = (list?: Paragraph['list']) => {
    current = { runs: [], ...(list ? { list } : {}) }
    paragraphs.push(current)
  }
  const walk = (node: Node, style: Style, list?: Paragraph['list']) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!current) start(list)
      current!.runs.push({ text: (node.textContent ?? '').replace(/ /g, ' '), ...style })
      return
    }
    if (!(node instanceof HTMLElement)) return
    if (node.tagName === 'BR') {
      if (!current) start(list)
      if (node.nextSibling) start(list)
      return
    }
    if (node.tagName === 'UL' || node.tagName === 'OL') {
      const kind = node.tagName === 'OL' ? 'number' : 'bullet'
      node.childNodes.forEach((child) => walk(child, style, kind))
      current = null
      return
    }
    const block = BLOCKS.has(node.tagName)
    if (block) start(node.tagName === 'LI' ? list : undefined)
    const inner = styleOf(node, style, zoom)
    node.childNodes.forEach((child) => walk(child, inner, list))
    if (block) current = null
  }
  root.childNodes.forEach((child) => walk(child, {}))
  const clean = paragraphs.map((p) => ({
    ...p,
    runs: tidyRuns(
      p.runs.map((run) => {
        const out: Run = { text: run.text }
        if (run.bold !== undefined) out.bold = run.bold
        if (run.italic) out.italic = true
        if (run.underline) out.underline = true
        if (run.strike) out.strike = true
        if (run.color) out.color = run.color
        if (run.size) out.size = run.size
        return out
      }),
    ),
  }))
  return clean.length > 0 ? clean : [{ runs: [{ text: '' }] }]
}

/** Formatting commands for the selected text in the editing box. */
export const format = (
  command:
    'bold' | 'italic' | 'underline' | 'strikeThrough' | 'insertUnorderedList' | 'insertOrderedList',
) => {
  document.execCommand('styleWithCSS', false, 'true')
  document.execCommand(command)
}

export const formatColor = (color: string) => {
  document.execCommand('styleWithCSS', false, 'true')
  document.execCommand('foreColor', false, color)
}

/** Sets the selected text's size (design pixels). */
export const formatSize = (editor: HTMLElement, size: number, zoom: number) => {
  document.execCommand('styleWithCSS', false, 'false')
  document.execCommand('fontSize', false, '7')
  editor.querySelectorAll('font[size="7"]').forEach((font) => {
    const span = document.createElement('span')
    span.style.fontSize = `${size * zoom}px`
    while (font.firstChild) span.appendChild(font.firstChild)
    font.replaceWith(span)
  })
}
