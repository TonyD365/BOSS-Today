import type { CollectionConfig } from 'payload'

import { withPermission } from '../access'
import { auditDelete } from '../hooks/audit'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate'
import { slugFrom } from '../hooks/slug'

export const Sections: CollectionConfig = {
  slug: 'sections',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'slug', 'order'], group: 'Site' },
  defaultSort: 'order',
  access: {
    read: () => true,
    create: withPermission('frontPage'),
    update: withPermission('frontPage'),
    delete: withPermission('frontPage'),
  },
  hooks: {
    beforeValidate: [slugFrom('name')],
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
