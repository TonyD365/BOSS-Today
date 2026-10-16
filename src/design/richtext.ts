import { isColor } from './color'
import type { Paragraph, Run } from './types'

export const MAX_TEXT = 4000

/** Plain text, one paragraph per line. */
export const plainParagraphs = (text: string): Paragraph[] =>
  text.split('\n').map((line) => ({ runs: [{ text: line }] }))

export const paragraphsText = (paragraphs: Paragraph[]) =>
  paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\n')

/** Keeps only known formatting, within limits. */
export const cleanParagraphs = (value: unknown): Paragraph[] => {
  if (!Array.isArray(value)) return [{ runs: [{ text: '' }] }]
  let budget = MAX_TEXT
  const paragraphs = value.slice(0, 200).map((p): Paragraph => {
    const raw = (p ?? {}) as { runs?: unknown; list?: unknown }
    const runs: Run[] = (Array.isArray(raw.runs) ? raw.runs : []).slice(0, 200).flatMap((r) => {
      const run = (r ?? {}) as Record<string, unknown>
      if (typeof run.text !== 'string' || budget <= 0) return []
      const text = run.text.replace(/[\u0000-\u0008\u000b-\u001f]/g, '').slice(0, budget)
      budget -= text.length
      const out: Run = { text }
      // false matters too: an unbolded word inside a bold heading.
      if (typeof run.bold === 'boolean') out.bold = run.bold
      if (run.italic === true) out.italic = true
      if (run.underline === true) out.underline = true
      if (run.strike === true) out.strike = true
      if (isColor(run.color)) out.color = run.color
      if (typeof run.size === 'number' && run.size >= 6 && run.size <= 300) out.size = run.size
      return [out]
    })
    const list: Paragraph['list'] =
      raw.list === 'bullet' || raw.list === 'number' ? raw.list : undefined
    return { runs: runs.length > 0 ? runs : [{ text: '' }], ...(list ? { list } : {}) }
  })
  return paragraphs.length > 0 ? paragraphs : [{ runs: [{ text: '' }] }]
}

/** Merges neighbouring runs with the same formatting. */
export const tidyRuns = (runs: Run[]): Run[] => {
  const out: Run[] = []
  for (const run of runs) {
    const last = out[out.length - 1]
    const same =
      last &&
      last.bold === run.bold &&
      last.italic === run.italic &&
      last.underline === run.underline &&
      last.strike === run.strike &&
      last.color === run.color &&
      last.size === run.size
    if (same) last.text += run.text
    else if (run.text || out.length === 0) out.push({ ...run })
  }
  return out.length > 0 ? out : [{ text: '' }]
}
