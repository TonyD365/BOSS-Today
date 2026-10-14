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
