import type { CollectionConfig } from 'payload'

import { atLeast, withPermission } from '../access'
import { auditDelete } from '../hooks/audit'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: { useAsTitle: 'alt', group: 'Newsroom' },
  hooks: { afterDelete: [auditDelete('image')] },
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
    // Store WebP no wider than 2400px: sharp enough for print, small enough for the image repo.
    resizeOptions: { width: 2400, withoutEnlargement: true },
    formatOptions: { format: 'webp', options: { quality: 82 } },
    imageSizes: [
      {
        name: 'thumb',
        formatOptions: { format: 'webp', options: { quality: 78 } },
        width: 400,
        withoutEnlargement: true,
      },
      {
        name: 'card',
        formatOptions: { format: 'webp', options: { quality: 78 } },
        width: 800,
        withoutEnlargement: true,
      },
      {
        name: 'hero',
        formatOptions: { format: 'webp', options: { quality: 78 } },
        width: 1600,
        withoutEnlargement: true,
      },
    ],
  },
}
