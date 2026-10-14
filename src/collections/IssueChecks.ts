import type { CollectionConfig } from 'payload'

import { canPublishIssues, isSuperAdminUser } from '../access'

/**
 * The sign-off trail for each issue: who read and ticked each story, which
 * version they read, and when (server time). Written only by the server and
 * never edited or deleted, so it can show who approved what went out.
 */
export const IssueChecks: CollectionConfig = {
  slug: 'issue-checks',
  labels: { singular: 'Sign-off', plural: 'Issue sign-offs' },
  admin: {
    useAsTitle: 'summary',
    defaultColumns: ['summary', 'checkedBy', 'createdAt'],
    group: 'Admin',
    hidden: ({ user }) => !canPublishIssues(user),
    description:
      'Every story ticked as checked before an issue was published, and every issue publish with its declaration. Permanent: nobody can edit or delete these.',
  },
  defaultSort: '-createdAt',
  access: {
    read: ({ req }) => isSuperAdminUser(req.user) || canPublishIssues(req.user),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'summary', type: 'text', required: true },
    {
      name: 'kind',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Story checked', value: 'checked' },
        { label: 'Story sent back', value: 'sent-back' },
        { label: 'Issue published', value: 'published' },
      ],
    },
    {
      name: 'issue',
      type: 'relationship',
      relationTo: 'issues',
      index: true,
      admin: { allowCreate: false },
    },
    {
      name: 'article',
      type: 'relationship',
      relationTo: 'articles',
      index: true,
      admin: { allowCreate: false },
    },
    {
      name: 'articleVersion',
      type: 'text',
      admin: { description: 'The story’s last-saved time when it was checked.' },
    },
    {
      name: 'checkedBy',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: { allowCreate: false },
    },
    { name: 'note', type: 'textarea' },
    { name: 'declaration', type: 'textarea' },
  ],
}
