import { APIError, type CollectionBeforeChangeHook, type CollectionConfig } from 'payload'

import { canPublishIssues } from '../access'
import { slugFrom } from '../hooks/slug'
import {
  auditLiveChange,
  refreshBoardAfterChange,
  refreshBoardAfterDelete,
} from '../publishing/board'

type Update = { id?: string | null; at?: string | null; text?: string | null; by?: unknown }

/**
 * Each update records who posted it, and when, however it was saved.
 */
const stampUpdates: CollectionBeforeChangeHook = ({ data, originalDoc, req }) => {
  if (!req.user) throw new APIError('Sign in first.', 401, undefined, true)
  const before = new Map(
    ((originalDoc?.updates as Update[] | undefined) ?? []).map((update) => [update.id, update]),
  )
  data.updates = ((data.updates as Update[] | undefined) ?? []).map((update) => {
    const old = update.id ? before.get(update.id) : undefined
    const changed = !old || (old.text ?? '') !== (update.text ?? '')
    const by = typeof old?.by === 'object' && old?.by ? (old.by as { id: number }).id : old?.by
    return {
      ...update,
      at: old?.at ?? update.at ?? new Date().toISOString(),
      by: changed ? Number(req.user!.id) : (by ?? Number(req.user!.id)),
    }
  })
  return data
}

/**
 * Coverage of an event as it happens, posted straight to the website. This
 * skips the issue sign-off, so only people with the Issue permission post.
 */
export const LiveBlogs: CollectionConfig = {
  slug: 'live-blogs',
  labels: { singular: 'Live coverage', plural: 'Live coverage' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'updatedAt'],
    group: 'Live',
    description:
      'Updates go straight to the website within a minute, without the issue sign-off. Only people with the Issue permission can post. Every update records who posted it.',
  },
  defaultSort: '-updatedAt',
  access: {
    read: ({ req }) => Boolean(req.user) && canPublishIssues(req.user),
    create: ({ req }) => canPublishIssues(req.user),
    update: ({ req }) => canPublishIssues(req.user),
    delete: ({ req }) => canPublishIssues(req.user),
  },
  hooks: {
    beforeValidate: [slugFrom('title')],
    beforeChange: [stampUpdates],
    afterChange: [refreshBoardAfterChange, auditLiveChange('live coverage')],
    afterDelete: [refreshBoardAfterDelete],
  },
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 120 },
    {
      name: 'summary',
      type: 'textarea',
      maxLength: 300,
      admin: { description: 'One or two sentences at the top of the page.' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'live',
          options: [
            { label: 'Live now', value: 'live' },
            { label: 'Ended', value: 'ended' },
          ],
          admin: {
            width: '50%',
            description: 'While live, the front page shows a LIVE link to it.',
          },
        },
        {
          name: 'slug',
          type: 'text',
          required: true,
          unique: true,
          index: true,
          admin: { width: '50%', description: 'Its address: /live/?s=this' },
        },
      ],
    },
    {
      name: 'updates',
      type: 'array',
      labels: { singular: 'Update', plural: 'Updates' },
      admin: {
        description: 'Add a row for each update. The newest appears at the top of the page.',
      },
      fields: [
        {
          name: 'at',
          type: 'date',
          label: 'Time',
          admin: {
            date: { pickerAppearance: 'dayAndTime' },
            description: 'Filled in automatically.',
          },
        },
        { name: 'text', type: 'textarea', required: true, maxLength: 2000 },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          admin: { description: 'Optional. Appears on the website within a few minutes.' },
        },
        {
          name: 'by',
          type: 'relationship',
          relationTo: 'users',
          admin: { readOnly: true, allowCreate: false },
        },
      ],
    },
  ],
}
