import type { CollectionConfig } from 'payload'

import { publishedOrStaff, withPermission } from '../access'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate'

/**
 * An issue is one edition of the paper: an ordered set of stories that is
 * published together, optionally with an automatically typeset print layout.
 */
export const Issues: CollectionConfig = {
  slug: 'issues',
  admin: {
    useAsTitle: 'title',
    group: 'Print',
    defaultColumns: ['title', 'volume', 'number', 'date', 'printEdition', '_status'],
    description:
      'Pick the stories for an edition, then publish. Tick "Print edition" to also get a paper layout.',
  },
  defaultSort: '-date',
  versions: { drafts: true, maxPerDoc: 10 },
  access: {
    read: publishedOrStaff,
    create: withPermission('print'),
    update: withPermission('print'),
    delete: withPermission('print'),
  },
  hooks: {
    afterChange: [revalidateAfterChange],
    afterDelete: [revalidateAfterDelete],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: { description: 'e.g. "October 2026" or "The Homecoming Issue".' },
    },
    {
      type: 'row',
      fields: [
        { name: 'volume', type: 'number', required: true, min: 1, defaultValue: 1 },
        { name: 'number', type: 'number', required: true, min: 1, defaultValue: 1 },
        { name: 'date', type: 'date', required: true, label: 'Issue date' },
      ],
    },
    {
      name: 'articles',
      type: 'relationship',
      relationTo: 'articles',
      hasMany: true,
      required: true,
      label: 'Stories',
      admin: {
        description:
          'Drag to reorder. The first story becomes the front-page lead of the print edition.',
      },
    },
    {
      name: 'printEdition',
      type: 'checkbox',
      label: 'Print edition — also typeset this issue for paper',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    {
      name: 'paperSize',
      type: 'select',
      defaultValue: 'letter',
      required: true,
      options: [
        { label: 'Letter (8.5 × 11 in)', value: 'letter' },
        { label: 'Tabloid (11 × 17 in)', value: 'tabloid' },
        { label: 'A4', value: 'a4' },
        { label: 'A3', value: 'a3' },
      ],
      admin: {
        position: 'sidebar',
        condition: (data) => Boolean(data?.printEdition),
      },
    },
    {
      name: 'printLink',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: { Field: '@/components/admin/PrintEditionLink#PrintEditionLink' },
      },
    },
  ],
}
