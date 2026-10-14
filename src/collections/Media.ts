import type { CollectionConfig } from 'payload'

import { atLeast, withPermission } from '../access'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: { useAsTitle: 'alt', group: 'Newsroom' },
  access: {
    read: () => true,
    create: atLeast('reporter'),
    update: atLeast('reporter'),
    delete: withPermission('media'),
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: { description: 'Describe the image for readers who cannot see it.' },
    },
    { name: 'caption', type: 'text' },
    { name: 'credit', type: 'text', admin: { description: 'Photographer or source.' } },
  ],
  upload: {
    mimeTypes: ['image/*'],
    imageSizes: [
      { name: 'thumb', width: 400, withoutEnlargement: true },
      { name: 'card', width: 800, withoutEnlargement: true },
      { name: 'hero', width: 1600, withoutEnlargement: true },
    ],
  },
}
