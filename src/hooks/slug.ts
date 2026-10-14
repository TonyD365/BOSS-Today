import type { CollectionBeforeValidateHook } from 'payload'

import { slugify } from '../lib/slugify'

/** Fills `slug` from another field when the editor leaves it blank. */
export const slugFrom =
  (source: string): CollectionBeforeValidateHook =>
  ({ data }) => {
    if (!data) return data
    if (data.slug) {
      data.slug = slugify(String(data.slug))
    } else if (data[source]) {
      data.slug = slugify(String(data[source]))
    }
    return data
  }

/** Placeholder web address for a story started before it has a headline. */
export const untitledSlug = () => `untitled-story-${Math.random().toString(36).slice(2, 8)}`

const UNTITLED = /^untitled-story(-[a-z0-9]+)?$/

/**
 * Like slugFrom('title'), but until a story is first published its web address
 * keeps following the headline, unless someone typed their own.
 */
export const storySlug: CollectionBeforeValidateHook = ({ data, originalDoc }) => {
  if (!data) return data
  const published = Boolean(originalDoc?.publishedAt ?? data.publishedAt)
  const previous = originalDoc?.slug as string | undefined
  const automatic =
    !previous || UNTITLED.test(previous) || previous === slugify(String(originalDoc?.title ?? ''))
  const titleChanged = data.title !== undefined && data.title !== originalDoc?.title
  if (!published && automatic && titleChanged && (!data.slug || data.slug === previous)) {
    const fromTitle = slugify(String(data.title ?? ''))
    if (fromTitle && fromTitle !== 'untitled-story') data.slug = fromTitle
  }
  if (data.slug) data.slug = slugify(String(data.slug))
  else if (data.title) data.slug = slugify(String(data.title))
  return data
}
