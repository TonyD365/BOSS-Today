import {
  APIError,
  type CollectionBeforeChangeHook,
  type CollectionBeforeValidateHook,
  type CollectionConfig,
  type Where,
} from 'payload'

import { atLeast, atLeastField, publishedOrStaff, RANK, rankOf } from '../access'
import {
  articleWorkflowEndpoint,
  WORKFLOW_STATES,
  type WorkflowState,
} from '../endpoints/articleWorkflow'
import { newStoryEndpoint } from '../endpoints/newStory'
import { storyViewsEndpoint } from '../endpoints/readership'
import { auditDelete, auditPublishing, deleteStoryComments } from '../hooks/audit'
import { guardPublishing } from '../hooks/publishing'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate'
import { storySlug } from '../hooks/slug'

type HistoryEntry = { status: WorkflowState; by?: number | null; at: string; note?: string | null }

/**
 * Keeps the review workflow consistent however a save arrives, and records each
 * change of state in the story's history.
 */
const syncWorkflow: CollectionBeforeChangeHook = ({ data, originalDoc, req, context }) => {
  const actor = req.user
  const previous = (originalDoc?.workflow ?? 'draft') as WorkflowState
  const action = context.workflowAction as string | undefined

  if (data._status === 'published') {
    // Only an issue publish gets here (see guardPublishing).
    data.workflow = 'published'
    if (!data.publishedAt && !originalDoc?.publishedAt) data.publishedAt = new Date().toISOString()
  } else if (!action) {
    // Outside the workflow panel the state can't be changed by hand.
    data.workflow = previous
  }

  // Once approved, the text is what the issue publisher will check; reporters
  // need an editor to send it back before changing it.
  if (!action && previous === 'approved' && actor && rankOf(actor) < RANK.editor) {
    throw new APIError(
      'This story is approved for the next issue. Ask an editor to send it back before changing it.',
      403,
      undefined,
      true,
    )
  }

  const history = [...((originalDoc?.history as HistoryEntry[] | undefined) ?? [])]
  if (data.workflow !== previous) {
    history.push({
      status: data.workflow,
      by: actor ? Number(actor.id) : null,
      at: new Date().toISOString(),
      note: (context.workflowNote as string | undefined) ?? null,
    })
  }
  data.history = history.map(({ status, by, at, note }) => ({
    status,
    by: typeof by === 'object' && by ? (by as { id: number }).id : by,
    at,
    note,
  }))
  return data
}

type Correction = { id?: string | null; date?: string | null; text?: string | null }

/**
 * A correction that readers have seen stays on the record: it can't be edited
 * or removed later, only followed by another correction.
 */
/** A correction row left empty is dropped rather than blocking publication. */
const dropEmptyCorrections: CollectionBeforeValidateHook = ({ data }) => {
  if (!data) return data
  const rows = data.corrections as Correction[] | null | undefined
  if (!Array.isArray(rows)) return data
  const kept = rows.filter((row) => (row.text ?? '').trim())
  if (kept.length !== rows.length) data.corrections = kept
  return data
}

const keepPublishedCorrections: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  if (operation !== 'update' || !originalDoc?.id || data.corrections === undefined) return data
  const live = await req.payload.findByID({
    collection: 'articles',
    id: originalDoc.id,
    draft: false,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
    req,
    select: { corrections: true, _status: true },
  })
  if (live?._status !== 'published') return data
  const next = ((data.corrections as Correction[] | null) ?? []).map((item) => ({ ...item }))
  for (const published of (live.corrections ?? []) as Correction[]) {
    const kept = next.find((item) => item.id === published.id)
    const same =
      kept &&
      (kept.text ?? '').trim() === (published.text ?? '').trim() &&
      new Date(kept.date ?? 0).getTime() === new Date(published.date ?? 0).getTime()
    if (!same) {
      throw new APIError(
        'Published corrections can’t be changed or removed. Add a new correction instead.',
        403,
        undefined,
        true,
      )
    }
  }
  return data
}

export const Articles: CollectionConfig = {
  slug: 'articles',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'section', 'authors', 'workflow', 'publishedAt'],
    group: 'Newsroom',
    components: {
      edit: {
        PublishButton: '@/components/admin/Hidden#Hidden',
        UnpublishButton: '@/components/admin/Hidden#Hidden',
      },
    },
    livePreview: {
      url: ({ data }) => (data?.id ? `/preview/articles/${data.id}` : null),
    },
  },
  defaultSort: '-updatedAt',
  versions: { drafts: true, maxPerDoc: 10 },
  endpoints: [articleWorkflowEndpoint, newStoryEndpoint, storyViewsEndpoint],
  access: {
    read: publishedOrStaff,
    create: atLeast('reporter'),
    // Reporters work on their own stories until they are published; editors handle the rest.
    update: ({ req }) => {
      const rank = rankOf(req.user)
      if (rank >= RANK.editor) return true
      if (rank < RANK.reporter || !req.user) return false
      const ownUnpublished: Where = {
        and: [{ authors: { in: [req.user.id] } }, { _status: { not_equals: 'published' } }],
      }
      return ownUnpublished
    },
    delete: atLeast('exec'),
  },
  hooks: {
    beforeValidate: [storySlug, dropEmptyCorrections],
    beforeChange: [guardPublishing('A story'), syncWorkflow, keepPublishedCorrections],
    afterChange: [revalidateAfterChange, auditPublishing('story')],
    beforeDelete: [deleteStoryComments],
    afterDelete: [revalidateAfterDelete, auditDelete('story')],
  },
  fields: [
    { name: 'title', type: 'text', required: true, label: 'Headline' },
    {
      name: 'summary',
      type: 'textarea',
      required: true,
      maxLength: 240,
      admin: { description: 'One or two sentences shown under the headline.' },
    },
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Lead image',
    },
    { name: 'content', type: 'richText', required: true, label: 'Story' },
    {
      name: 'corrections',
      type: 'array',
      labels: { singular: 'Correction', plural: 'Corrections' },
      access: { update: atLeastField('editor') },
      admin: {
        description:
          'Shown at the end of the story with an “Updated” date. Once published, a correction stays: add a new one rather than changing it. Goes live with the next issue.',
        condition: (data) => Boolean(data?.publishedAt) || (data?.corrections?.length ?? 0) > 0,
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'date',
              type: 'date',
              required: true,
              defaultValue: () => new Date().toISOString(),
              admin: { width: '30%', date: { pickerAppearance: 'dayOnly' } },
            },
            {
              name: 'text',
              type: 'textarea',
              required: true,
              admin: {
                width: '70%',
                placeholder:
                  'An earlier version of this article misstated the date of the game. It was Oct. 3.',
              },
            },
          ],
        },
      ],
    },
    {
      name: 'workflowPanel',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: { Field: '@/components/admin/WorkflowPanel#WorkflowPanel' },
      },
    },
    {
      name: 'writingHints',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: { Field: '@/components/admin/WritingHints#WritingHints' },
      },
    },
    {
      name: 'instagramImages',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: { Field: '@/components/admin/InstagramImages#InstagramImages' },
      },
    },
    {
      name: 'storyViews',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: { Field: '@/components/admin/StoryViews#StoryViews' },
      },
    },
    {
      name: 'commentsPanel',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: { Field: '@/components/admin/CommentsPanel#CommentsPanel' },
      },
    },
    {
      name: 'workflow',
      type: 'select',
      defaultValue: 'draft',
      index: true,
      options: WORKFLOW_STATES.map((value) => ({
        value,
        label: {
          draft: 'Draft',
          review: 'In review',
          changes: 'Changes requested',
          approved: 'Waiting for the next issue',
          published: 'Published',
          withdrawn: 'Withdrawn',
        }[value],
      })),
      admin: { hidden: true },
    },
    {
      name: 'reviewNotes',
      type: 'textarea',
      label: 'Notes from the editor',
      access: { update: atLeastField('editor') },
      admin: {
        position: 'sidebar',
        condition: (data) => Boolean(data?.reviewNotes),
        readOnly: true,
      },
    },
    {
      name: 'section',
      type: 'relationship',
      relationTo: 'sections',
      required: true,
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'authors',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
      required: true,
      defaultValue: ({ user }) => (user ? [user.id] : []),
      filterOptions: { role: { not_equals: 'reader' } },
      // People are added under People, never from a story.
      admin: { position: 'sidebar', allowCreate: false },
    },
    {
      name: 'guestByline',
      type: 'text',
      label: 'Guest byline',
      access: { update: atLeastField('editor') },
      admin: {
        position: 'sidebar',
        description:
          'For letters and guest writers, e.g. “Jane Doe, Grade 11”. Shown on the website instead of the authors above, who stay on record as responsible for the story.',
      },
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Topics this story belongs to. Editors add new tags under Site → Tags.',
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      index: true,
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Filled in automatically the first time the story is published.',
      },
    },
    { name: 'slug', type: 'text', unique: true, index: true, admin: { position: 'sidebar' } },
    {
      name: 'history',
      type: 'array',
      label: 'Review history',
      admin: { readOnly: true, initCollapsed: true },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'status',
              type: 'select',
              options: WORKFLOW_STATES.map((value) => ({ label: value, value })),
            },
            {
              name: 'by',
              type: 'relationship',
              relationTo: 'users',
              admin: { allowCreate: false },
            },
            { name: 'at', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
          ],
        },
        { name: 'note', type: 'textarea' },
      ],
    },
  ],
}
