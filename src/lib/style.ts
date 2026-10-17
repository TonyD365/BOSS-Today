/**
 * News-writing checks for the "Writing notes" panel: suggestions, not rules.
 * They follow common newsroom (AP) style and never block saving.
 */
type LexicalNode = { type?: string; text?: string; children?: LexicalNode[] }

const textOf = (node: LexicalNode): string =>
  node.text ?? (node.children ?? []).map(textOf).join(node.type === 'listitem' ? '' : '')

/** The story's paragraphs (and headings and list items) as plain text. */
export const paragraphsOf = (content: unknown): string[] => {
  const root = (content as { root?: LexicalNode } | null)?.root
  const out: string[] = []
  const walk = (node: LexicalNode) => {
    if (node.type === 'list') return (node.children ?? []).forEach(walk)
    const text = textOf(node).replace(/\s+/g, ' ').trim()
    if (text) out.push(text)
  }
  ;(root?.children ?? []).forEach(walk)
  return out
}

const words = (text: string) => (text.match(/\S+/g) ?? []).length
const sentences = (text: string) => text.split(/(?<=[.!?])\s+(?=[A-Z“"])/)

const MONTHS =
  'January|February|March|April|May|June|July|August|September|October|November|December'

export type StyleNote = { text: string; example?: string }

export const styleNotes = (title: string, content: unknown): StyleNote[] => {
  const paragraphs = paragraphsOf(content)
  const body = paragraphs.join('\n')
  const total = words(body)
  const notes: StyleNote[] = []
  const first = (re: RegExp) => body.match(re)?.[0]

  if (/!/.test(title)) notes.push({ text: 'Headlines don’t use exclamation marks.' })
  if (/\.\s*$/.test(title.trim())) notes.push({ text: 'Headlines don’t end with a full stop.' })
  const shouting = title.match(/\b[A-Z]{4,}\b/g)?.filter((w) => !/^[IVXLC]+$/.test(w))
  if (shouting?.length)
    notes.push({ text: 'Avoid words in capitals in the headline.', example: shouting[0] })

  if (total >= 200) {
    const quoted = /["“”]/.test(body)
    const attributed = /\b(said|says|told|according to|explained|added|asked)\b/i.test(body)
    if (!quoted && !attributed)
      notes.push({
        text: 'No one is quoted or named as a source. News stories need at least one person or document saying it.',
      })
  }
  const anonymous = first(/\b(a source|sources|an anonymous (student|teacher|source))\b[^.]{0,40}/i)
  if (anonymous)
    notes.push({
      text: 'Unnamed sources need an editor’s approval (see Our standards).',
      example: anonymous,
    })

  const long = paragraphs.filter((p) => words(p) > 80).length
  if (long > 0)
    notes.push({
      text: `${long === 1 ? 'A paragraph is' : `${long} paragraphs are`} over 80 words. News paragraphs are usually one to three sentences.`,
    })
  const longSentence = paragraphs.flatMap(sentences).find((s) => words(s) > 40)
  if (longSentence)
    notes.push({
      text: 'A sentence is over 40 words. Try splitting it.',
      example: `${longSentence.split(' ').slice(0, 8).join(' ')}…`,
    })

  const ordinal = first(
    new RegExp(
      `\\b(${MONTHS}|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\\.? \\d{1,2}(st|nd|rd|th)\\b`,
    ),
  )
  if (ordinal)
    notes.push({
      text: 'Dates don’t take st, nd, rd or th.',
      example: `${ordinal} → ${ordinal.replace(/(st|nd|rd|th)$/, '')}`,
    })
  const fullMonth = first(
    /\b(January|February|August|September|October|November|December) \d{1,2}\b/,
  )
  if (fullMonth)
    notes.push({
      text: 'With a date, shorten Jan., Feb., Aug., Sept., Oct., Nov. and Dec.',
      example: fullMonth,
    })
  const time = first(/\b\d{1,2}(:\d{2})?\s?(AM|PM|am|pm)\b/)
  if (time) notes.push({ text: 'Write times as 3 p.m. or 3:30 p.m.', example: time })
  const zeros = first(/\b\d{1,2}:00\s?(a\.m\.|p\.m\.)/)
  if (zeros) notes.push({ text: 'Leave out :00 in times.', example: zeros })
  const percentSign = first(/\d+(\.\d+)?\s?%/)
  if (percentSign)
    notes.push({
      text: 'Write “per cent” in stories (Canadian Press style).',
      example: percentSign,
    })

  const bangs = (body.match(/!/g) ?? []).length
  if (bangs > 0)
    notes.push({
      text: `${bangs} exclamation mark${bangs === 1 ? '' : 's'} in the story. News writing rarely uses them outside quotes.`,
    })
  const fillers = (body.match(/\b(very|really|basically|literally|extremely)\b/gi) ?? []).length
  if (fillers >= 4)
    notes.push({ text: `“Very”, “really” and similar words appear ${fillers} times. Most can go.` })
  if (/[.!?] {2,}\S/.test(JSON.stringify(content ?? '')))
    notes.push({ text: 'Use one space after a full stop.' })
  return notes
}
