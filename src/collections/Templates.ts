import type { CollectionConfig } from 'payload'

import { atLeast } from '../access'

/** Starting structures for common kinds of story, with "TK" prompts to replace. */
export const Templates: CollectionConfig = {
  slug: 'templates',
  labels: { singular: 'Story template', plural: 'Story templates' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'section', 'updatedAt'],
    group: 'Newsroom',
    description:
      'Reporters can start a story from one of these. Write prompts as “TK: …”: a story can’t be approved until every TK is replaced.',
  },
  defaultSort: 'name',
  access: {
    read: atLeast('reporter'),
    create: atLeast('editor'),
    update: atLeast('editor'),
    delete: atLeast('editor'),
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'description',
      type: 'textarea',
      maxLength: 300,
      admin: { description: 'When to use it, shown when choosing a template.' },
    },
    {
      name: 'section',
      type: 'relationship',
      relationTo: 'sections',
      admin: { allowCreate: false, description: 'Filled in for new stories. Optional.' },
    },
    { name: 'content', type: 'richText', required: true, label: 'Story structure' },
  ],
}
