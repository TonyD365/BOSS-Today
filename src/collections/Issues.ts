import type { CollectionConfig } from 'payload'

import { canPublishIssues, hasPermission, publishedOrStaff } from '../access'
import {
  issueAddWaitingEndpoint,
  issueCheckEndpoint,
  issuePublishEndpoint,
  issueReviewEndpoint,
} from '../endpoints/issuePublishing'
import { auditDelete, auditPublishing } from '../hooks/audit'
import { guardPublishing } from '../hooks/publishing'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate'

const canManageIssues = (user: unknown) => canPublishIssues(user) || hasPermission(user, 'print')

/**
 * An issue is one edition of the paper: an ordered set of stories that is
 * published together, optionally with an automatically typeset print layout.
 */
export const Issues: CollectionConfig = {
  slug: 'issues',
  admin: {
    useAsTitle: 'title',
    group: 'Print',
    components: {
      edit: {
        PublishButton: '@/components/admin/Hidden#Hidden',
        UnpublishButton: '@/components/admin/Hidden#Hidden',
      },
    },
    defaultColumns: ['title', 'volume', 'number', 'date', 'printEdition', '_status'],
    description:
      'An issue is how stories reach the website: publishing it puts every story waiting for the next issue online at once. Tick "Print edition" to also typeset it for paper.',
  },
  defaultSort: '-date',
  versions: { drafts: true, maxPerDoc: 10 },
  access: {
    read: publishedOrStaff,
    create: ({ req }) => canManageIssues(req.user),
    update: ({ req }) => canManageIssues(req.user),
    delete: ({ req }) => canManageIssues(req.user),
  },
  endpoints: [
    issueReviewEndpoint,
    issueAddWaitingEndpoint,
    issueCheckEndpoint,
    issuePublishEndpoint,
  ],
  hooks: {
    beforeChange: [guardPublishing('An issue')],
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
      labels: { singular: 'Story', plural: 'Stories' },
      admin: {
        description:
          'Which stories the print edition carries, in order; the first is the front-page lead. "Add all waiting stories" in the sidebar fills this in. The website gets every waiting story either way.',
        components: { RowLabel: '@/components/admin/StoryRowLabel#StoryRowLabel' },
      },
      fields: [
        {
          name: 'article',
          type: 'relationship',
          relationTo: 'articles',
          required: true,
          // Stories are written under Articles, not from inside an issue.
          admin: { allowCreate: false },
        },
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
      name: 'publishedBy',
      type: 'relationship',
      relationTo: 'users',
      label: 'Published by',
      access: { create: () => false, update: () => false },
      admin: {
        position: 'sidebar',
        readOnly: true,
        allowCreate: false,
        condition: (data) => Boolean(data?.publishedBy),
        description:
          'Signed the publisher’s declaration. See Issue sign-offs for every story check.',
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      access: { create: () => false, update: () => false },
      admin: {
        position: 'sidebar',
        readOnly: true,
        condition: (data) => Boolean(data?.publishedAt),
        date: { pickerAppearance: 'dayAndTime' },
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
