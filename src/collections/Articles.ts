import type { CollectionConfig, Where } from 'payload'

import { isEditor, isEditorField, isStaff, publishedOrStaff, type Role } from '../access'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate'
import { slugFrom } from '../hooks/slug'

export const Articles: CollectionConfig = {
  slug: 'articles',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'section', 'authors', '_status', 'publishedAt'],
  },
  defaultSort: '-publishedAt',
  versions: { drafts: true, maxPerDoc: 25 },
  access: {
    read: publishedOrStaff,
    create: isStaff,
    // Writers work on their own unpublished drafts; editors handle the rest.
    update: ({ req }) => {
      if (!req.user) return false
      if ((req.user as { role?: Role }).role !== 'writer') return true
      const ownDrafts: Where = {
        and: [{ authors: { in: [req.user.id] } }, { _status: { not_equals: 'published' } }],
      }
      return ownDrafts
    },
    delete: isEditor,
  },
  hooks: {
    beforeValidate: [slugFrom('title')],
    beforeChange: [
      ({ data, req, originalDoc }) => {
        const role = (req.user as { role?: Role } | null)?.role
        if (role === 'writer' && data._status === 'published') {
          data._status = 'draft'
        }
        if (data._status === 'published' && !data.publishedAt && !originalDoc?.publishedAt) {
          data.publishedAt = new Date().toISOString()
        }
        return data
      },
    ],
    afterChange: [revalidateAfterChange],
    afterDelete: [revalidateAfterDelete],
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
      admin: { position: 'sidebar' },
    },
    {
      name: 'readyForReview',
      type: 'checkbox',
      label: 'Ready for an editor to review',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    {
      name: 'placement',
      type: 'select',
      defaultValue: 'standard',
      required: true,
      access: { create: isEditorField, update: isEditorField },
      options: [
        { label: 'Lead story (top of the front page)', value: 'lead' },
        { label: 'Featured (front page, beside the lead)', value: 'featured' },
        { label: 'Standard', value: 'standard' },
      ],
      admin: { position: 'sidebar', description: 'Where this story sits on the home page.' },
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
  ],
}
