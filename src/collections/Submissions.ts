import type { CollectionConfig } from 'payload'

import { atLeast, RANK, rankOf } from '../access'
import {
  submissionToAssignmentEndpoint,
  submissionToStoryEndpoint,
  submitEndpoint,
} from '../endpoints/submissions'

export const SUBMISSION_KINDS = [
  { label: 'Letter to the Editor', value: 'letter' },
  { label: 'News tip', value: 'tip' },
  { label: 'Correction request', value: 'correction' },
] as const

/**
 * Letters, tips and correction requests sent from the public site. Only
 * editors and above see them: they hold readers' contact details.
 */
export const Submissions: CollectionConfig = {
  slug: 'submissions',
  labels: { singular: 'Reader submission', plural: 'Reader submissions' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['kind', 'name', 'status', 'emailConfirmed', 'createdAt'],
    group: 'Newsroom',
    hidden: ({ user }) => rankOf(user) < RANK.editor,
    description:
      'Sent from the Contact page. Before a letter is published, email the writer from your own address to confirm their email and identity, then tick both boxes.',
  },
  defaultSort: '-createdAt',
  endpoints: [submitEndpoint, submissionToStoryEndpoint, submissionToAssignmentEndpoint],
  access: {
    read: atLeast('editor'),
    // Readers send these through /api/submissions/submit, never directly.
    create: () => false,
    update: atLeast('editor'),
    delete: atLeast('editor'),
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'kind',
          type: 'select',
          required: true,
          options: [...SUBMISSION_KINDS],
          access: { update: () => false },
          admin: { width: '50%' },
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'new',
          index: true,
          options: [
            { label: 'New', value: 'new' },
            { label: 'In progress', value: 'inProgress' },
            { label: 'Used', value: 'used' },
            { label: 'Replied', value: 'replied' },
            { label: 'Not used', value: 'declined' },
            { label: 'Spam', value: 'spam' },
          ],
          admin: { width: '50%' },
        },
      ],
    },
    {
      name: 'body',
      type: 'textarea',
      required: true,
      label: 'What they wrote',
      access: { update: () => false },
      admin: { readOnly: true },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          access: { update: () => false },
          admin: { readOnly: true, width: '34%' },
        },
        {
          name: 'email',
          type: 'email',
          access: { update: () => false },
          admin: {
            readOnly: true,
            width: '33%',
            description: 'Removed automatically 180 days after the submission is dealt with.',
          },
        },
        {
          name: 'affiliation',
          type: 'text',
          label: 'Grade or role',
          access: { update: () => false },
          admin: { readOnly: true, width: '33%' },
        },
      ],
    },
    {
      name: 'article',
      type: 'relationship',
      relationTo: 'articles',
      label: 'About the story',
      access: { update: () => false },
      admin: { readOnly: true, allowCreate: false },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'emailConfirmed',
          type: 'checkbox',
          label: 'Email confirmed',
          index: true,
          admin: {
            width: '50%',
            description: 'They replied to an email we sent to this address.',
          },
        },
        {
          name: 'identityConfirmed',
          type: 'checkbox',
          label: 'Identity confirmed',
          admin: { width: '50%', description: 'We are satisfied they are who they say.' },
        },
      ],
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'Internal notes',
      admin: { description: 'Only editors see these.' },
    },
    {
      name: 'handledBy',
      type: 'relationship',
      relationTo: 'users',
      filterOptions: { role: { in: ['editor', 'exec'] } },
      admin: { allowCreate: false },
    },
    {
      name: 'actions',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: { Field: '@/components/admin/SubmissionActions#SubmissionActions' },
      },
    },
    {
      name: 'story',
      type: 'relationship',
      relationTo: 'articles',
      label: 'Turned into story',
      admin: { position: 'sidebar', readOnly: true, allowCreate: false },
    },
    {
      name: 'assignment',
      type: 'relationship',
      relationTo: 'assignments',
      label: 'Turned into assignment',
      admin: { position: 'sidebar', readOnly: true, allowCreate: false },
    },
    {
      name: 'ipHash',
      type: 'text',
      index: true,
      access: { read: () => false, update: () => false },
      admin: { hidden: true },
    },
    { name: 'contactRemovedAt', type: 'date', admin: { hidden: true } },
  ],
}
