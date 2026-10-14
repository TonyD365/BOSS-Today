import type { Article } from '../payload-types'

const SUMMARY_LIMIT = 240

type LexicalNode = { type?: string; text?: string; children?: LexicalNode[] }

/** True when the story body has any words, images or embeds in it. */
const hasBody = (content: unknown): boolean => {
  const walk = (node: LexicalNode | undefined): boolean => {
    if (!node) return false
    if (node.type === 'upload' || node.type === 'block') return true
    if (typeof node.text === 'string' && node.text.trim()) return true
    return (node.children ?? []).some(walk)
  }
  return walk((content as { root?: LexicalNode } | null)?.root)
}

/**
 * What would stop a story from being published, in plain words. Drafts can be
 * saved half-finished, so this is checked when a story is approved and again
 * before an issue goes out.
 */
export const publishingProblems = (
  article: Pick<Article, 'title' | 'summary' | 'content' | 'section' | 'authors'>,
): string[] => {
  const problems: string[] = []
  if (!article.title?.trim()) problems.push('the headline is empty')
  const summary = article.summary?.trim() ?? ''
  if (!summary) problems.push('the summary is empty')
  else if (summary.length > SUMMARY_LIMIT) {
    problems.push(`the summary is ${summary.length} characters (the limit is ${SUMMARY_LIMIT})`)
  }
  if (!hasBody(article.content)) problems.push('the story body is empty')
  if (!article.section) problems.push('no section is chosen')
  if (!article.authors || article.authors.length === 0) problems.push('no author is set')
  return problems
}

export const describeProblems = (problems: string[]) =>
  problems.length === 0
    ? ''
    : `${problems[0][0].toUpperCase()}${problems[0].slice(1)}${problems.length > 1 ? `; ${problems.slice(1).join('; ')}` : ''}.`
