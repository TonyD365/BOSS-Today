import type { CollectionConfig } from 'payload'

import { RANK, rankOf } from '../access'
import { cleanDesign } from '../design/sanitize'
import { canDesign } from '../endpoints/siteDesign'

/** Designs saved in the site designer to start new pages from. Never shown on the site. */
export const DesignTemplates: CollectionConfig = {
  slug: 'design-templates',
  labels: { singular: 'Design template', plural: 'Design templates' },
  admin: {
    useAsTitle: 'name',
    group: 'Site',
    hidden: true,
  },
  access: {
    read: ({ req }) => rankOf(req.user) >= RANK.reporter,
    create: ({ req }) => canDesign(req.user),
    update: ({ req }) => canDesign(req.user),
    delete: ({ req }) => canDesign(req.user),
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data.design !== undefined) {
          const design = cleanDesign(data.design)
          delete design.guides
          data.design = { ...design, desktopChangedAt: null, phoneCheckedAt: null }
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true, maxLength: 60 },
    { name: 'design', type: 'json', required: true },
  ],
}
