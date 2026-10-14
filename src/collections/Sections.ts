import type { CollectionConfig } from 'payload'

import { isAdmin, isEditor } from '../access'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate'
import { slugFrom } from '../hooks/slug'

export const Sections: CollectionConfig = {
  slug: 'sections',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'slug', 'order'] },
  defaultSort: 'order',
  access: {
    read: () => true,
    create: isEditor,
    update: isEditor,
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [slugFrom('name')],
    afterChange: [revalidateAfterChange],
    afterDelete: [revalidateAfterDelete],
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
