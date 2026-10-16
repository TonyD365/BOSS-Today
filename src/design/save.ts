import { APIError } from 'payload'

import { cleanDesign, contrastProblems } from './sanitize'
import type { Design } from './types'

/**
 * Cleans a canvas before it is stored and, unless an issue is publishing it,
 * refuses text that is hard to read. Notes when the desktop canvas changed,
 * so the issue checklist can ask whether the phone layout was looked at since.
 */
export const prepareDesign = (
  value: unknown,
  original: unknown,
  check: boolean,
  label: string,
): Design => {
  const design = cleanDesign(value)
  if (check) {
    const problems = contrastProblems(design)
    if (problems.length > 0) {
      const first = problems[0]
      throw new APIError(
        `${label}: some text is hard to read. “${first.label}” on ${first.view} has contrast ${first.ratio}:1 (needs ${first.needed}:1). Try ${first.suggestion}.`,
        400,
        { problems },
        true,
      )
    }
  }
  const before = cleanDesign(original)
  if (JSON.stringify(before.desktop) !== JSON.stringify(design.desktop)) {
    design.desktopChangedAt = new Date().toISOString()
  }
  return design
}

/** A stored canvas, or null when nothing has been designed. */
export const storedDesign = (value: unknown): Design | null => {
  if (!value || typeof value !== 'object') return null
  const design = cleanDesign(value)
  return design.desktop.elements.length > 0 ? design : null
}
