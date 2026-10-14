import type { CollectionConfig } from 'payload'

import { atLeast } from '../access'
import { assignmentClaimEndpoint, assignmentStartEndpoint } from '../endpoints/assignments'

/**
 * Story ideas, who is writing them and when they are due. Where an assignment
 * stands on the board follows its story's review state automatically.
 */
export const Assignments: CollectionConfig = {
  slug: 'assignments',
  labels: { singular: 'Assignment', plural: 'Assignments' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'section', 'reporters', 'deadline', 'article'],
    group: 'Newsroom',
    description: 'Story ideas and who is writing them. See them all on the Assignment board.',
  },
  defaultSort: 'deadline',
  endpoints: [assignmentClaimEndpoint, assignmentStartEndpoint],
  access: {
    read: atLeast('reporter'),
    // Reporters claim and start assignments through the board, not by editing.
    create: atLeast('editor'),
    update: atLeast('editor'),
    delete: atLeast('editor'),
  },
  fields: [
    { name: 'title', type: 'text', required: true, label: 'Story idea' },
    {
      name: 'brief',
      type: 'textarea',
      admin: { description: 'What to cover, who to interview, the angle.' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'section',
          type: 'relationship',
          relationTo: 'sections',
          admin: { allowCreate: false, width: '50%' },
        },
        {
          name: 'deadline',
          type: 'date',
          required: true,
          index: true,
          admin: { width: '50%', date: { pickerAppearance: 'dayAndTime' } },
        },
      ],
    },
    {
      name: 'reporters',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
      filterOptions: { role: { not_equals: 'reader' } },
      admin: {
        allowCreate: false,
        description: 'Leave empty to let a reporter claim it.',
      },
    },
    {
      name: 'editor',
      type: 'relationship',
      relationTo: 'users',
      defaultValue: ({ user }) => user?.id,
      filterOptions: { role: { in: ['editor', 'exec'] } },
      admin: { allowCreate: false, description: 'Who will review the story.' },
    },
    {
      name: 'issue',
      type: 'relationship',
      relationTo: 'issues',
      admin: { allowCreate: false, description: 'Optional: the issue it is meant for.' },
    },
    {
      name: 'article',
      type: 'relationship',
      relationTo: 'articles',
      label: 'Story',
      admin: {
        position: 'sidebar',
        readOnly: true,
        allowCreate: false,
        description: 'Created when a reporter clicks “Start writing” on the board.',
      },
    },
  ],
}
