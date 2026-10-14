type LexicalNode = { type?: string; text?: string; children?: LexicalNode[] }

/** The words of a story body, ignoring formatting, images and embeds. */
export const plainText = (content: unknown): string => {
  const parts: string[] = []
  const walk = (node: LexicalNode | undefined) => {
    if (!node) return
    if (typeof node.text === 'string') parts.push(node.text)
    for (const child of node.children ?? []) walk(child)
    // Keep words in separate paragraphs apart.
    if (node.children) parts.push(' ')
  }
  walk((content as { root?: LexicalNode } | null)?.root)
  return parts.join('').replace(/\s+/g, ' ').trim()
}

export const wordCount = (content: unknown): number => {
  const text = plainText(content)
  return text ? text.split(' ').length : 0
}

/** Adult readers manage about 230 words a minute; never less than one minute. */
export const WORDS_PER_MINUTE = 230

export const readingMinutes = (content: unknown): number =>
  Math.max(1, Math.round(wordCount(content) / WORDS_PER_MINUTE))

/**
 * "TK" ("to come") is the newsroom mark for something still missing. Templates
 * use it for their prompts, so a story still containing it isn't finished.
 */
export const PLACEHOLDER = /\bTK\b/

export const hasPlaceholders = (content: unknown): boolean => PLACEHOLDER.test(plainText(content))
