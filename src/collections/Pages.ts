import { type CollectionBeforeChangeHook, type CollectionConfig } from 'payload'

import { RANK, rankOf } from '../access'
import { prepareDesign } from '../design/save'
import { assertDesignLock, canDesign } from '../endpoints/siteDesign'
import { auditDelete } from '../hooks/audit'
import { guardPublishing } from '../hooks/publishing'
import { slugFrom } from '../hooks/slug'

const checkPage: CollectionBeforeChangeHook = async ({ data, originalDoc, req, context }) => {
  if (data.design === undefined || data.design === null) return data
  const check = !context.issuePublish
  if (check) await assertDesignLock(req)
  data.design = prepareDesign(data.design, originalDoc?.design, check, String(data.title ?? 'Page'))
  return data
}

/**
 * Pages built in the site designer, such as About us or Join us, at
 * /p/<slug>/. Like everything else, changes go live with the next issue.
 */
export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: { singular: 'Custom page', plural: 'Custom pages' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', '_status', 'updatedAt'],
    group: 'Site',
    description: 'Pages designed in the site designer. Changes go live with the next issue.',
    components: {
      edit: {
        PublishButton: '@/components/admin/Hidden#Hidden',
        UnpublishButton: '@/components/admin/Hidden#Hidden',
      },
    },
  },
  versions: { drafts: true, maxPerDoc: 10 },
  access: {
    read: ({ req }) => rankOf(req.user) >= RANK.reporter,
    create: ({ req }) => canDesign(req.user),
    update: ({ req }) => canDesign(req.user),
    delete: ({ req }) => canDesign(req.user),
  },
  hooks: {
    beforeValidate: [slugFrom('title')],
    beforeChange: [guardPublishing('A page'), checkPage],
    afterDelete: [auditDelete('page')],
  },
  fields: [
    {
      name: 'designer',
      type: 'ui',
      admin: { components: { Field: '@/components/admin/designer/DesignSummary#DesignSummary' } },
    },
    { name: 'title', type: 'text', required: true, maxLength: 80 },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { position: 'sidebar', description: 'The address: /p/this-name/' },
    },
    {
      name: 'description',
      type: 'textarea',
      maxLength: 200,
      admin: { description: 'For search engines and link previews.' },
    },
    {
      type: 'row',
      fields: [
        { name: 'showInNav', type: 'checkbox', label: 'Show in the navigation bar' },
        {
          name: 'showInFooter',
          type: 'checkbox',
          label: 'Show in the footer links',
          defaultValue: true,
        },
      ],
    },
    { name: 'design', type: 'json', admin: { hidden: true } },
  ],
}
