import type { CollectionConfig } from 'payload'

import { atLeast, publishedOrStaff } from '../access'
import { auditDelete } from '../hooks/audit'
import { guardPublishing } from '../hooks/publishing'
import { slugFrom } from '../hooks/slug'

/** Topics that run across sections, e.g. "Homecoming 2026". Each gets its own page. */
export const Tags: CollectionConfig = {
  slug: 'tags',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', '_status', 'updatedAt'],
    group: 'Site',
    description:
      'Topics that link related stories, each with its own page. Changes go live with the next issue.',
    components: {
      edit: {
        PublishButton: '@/components/admin/Hidden#Hidden',
        UnpublishButton: '@/components/admin/Hidden#Hidden',
      },
    },
  },
  versions: { drafts: true, maxPerDoc: 10 },
  defaultSort: 'name',
  access: {
    read: publishedOrStaff,
    // Reporters choose from existing tags so the list stays tidy.
    create: atLeast('editor'),
    update: atLeast('editor'),
    delete: atLeast('editor'),
  },
  hooks: {
    beforeValidate: [slugFrom('name')],
    beforeChange: [guardPublishing('A tag')],
    afterDelete: [auditDelete('tag')],
  },
  fields: [
    { name: 'name', type: 'text', required: true, unique: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'description',
      type: 'textarea',
      maxLength: 400,
      admin: { description: 'One or two sentences shown at the top of the topic page.' },
    },
    { name: 'image', type: 'upload', relationTo: 'media', admin: { position: 'sidebar' } },
  ],
}
