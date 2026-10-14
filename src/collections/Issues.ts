import type { CollectionConfig } from 'payload'

import { publishedOrStaff, withPermission } from '../access'
import { auditDelete, auditPublishing } from '../hooks/audit'
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
    afterChange: [revalidateAfterChange, auditPublishing('issue')],
    afterDelete: [revalidateAfterDelete, auditDelete('issue')],
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
      name: 'stories',
      type: 'array',
      required: true,
      minRows: 1,
      labels: { singular: 'Story', plural: 'Stories' },
      admin: {
        description:
          'Drag to reorder. The first story is the front-page lead of the print edition. Width and image only affect the print edition.',
        components: { RowLabel: '@/components/admin/StoryRowLabel#StoryRowLabel' },
      },
      fields: [
        { name: 'article', type: 'relationship', relationTo: 'articles', required: true },
        {
          type: 'row',
          fields: [
            {
              name: 'width',
              type: 'select',
              required: true,
              defaultValue: 'full',
              options: [
                { label: 'Full page width', value: 'full' },
                { label: 'Two-thirds', value: 'twoThirds' },
                { label: 'Half', value: 'half' },
                { label: 'One column', value: 'column' },
              ],
            },
            { name: 'showImage', type: 'checkbox', defaultValue: true, label: 'Show lead image' },
          ],
        },
      ],
    },
    {
      name: 'announcement',
      type: 'textarea',
      admin: {
        description: 'Optional notice boxed on the front page of the print edition.',
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
      name: 'showContents',
      type: 'checkbox',
      defaultValue: true,
      label: 'Table of contents on the front page',
      admin: { position: 'sidebar', condition: (data) => Boolean(data?.printEdition) },
    },
    {
      name: 'showStaffBox',
      type: 'checkbox',
      defaultValue: true,
      label: 'Staff box on the last page',
      admin: { position: 'sidebar', condition: (data) => Boolean(data?.printEdition) },
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
