import type { CollectionConfig } from 'payload'

import { publishedOrStaff, withPermission } from '../access'
import { auditDelete } from '../hooks/audit'
import { guardPublishing } from '../hooks/publishing'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate'
import { slugFrom } from '../hooks/slug'

export const Sections: CollectionConfig = {
  slug: 'sections',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'order', '_status'],
    group: 'Site',
    description: 'Changes are saved as drafts and go live with the next issue.',
    components: {
      edit: {
        PublishButton: '@/components/admin/Hidden#Hidden',
        UnpublishButton: '@/components/admin/Hidden#Hidden',
      },
    },
  },
  versions: { drafts: true, maxPerDoc: 10 },
  defaultSort: 'order',
  access: {
    read: publishedOrStaff,
    create: withPermission('design'),
    update: withPermission('design'),
    delete: withPermission('design'),
  },
  hooks: {
    beforeValidate: [slugFrom('name')],
    beforeChange: [guardPublishing('A section')],
    afterChange: [revalidateAfterChange],
    afterDelete: [revalidateAfterDelete, auditDelete('section')],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'description', type: 'textarea' },
    {
      name: 'order',
      type: 'number',
      defaultValue: 10,
      admin: { description: 'Lower numbers appear first in the navigation bar.' },
    },
  ],
}
