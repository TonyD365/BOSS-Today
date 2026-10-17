import type { Block } from 'payload'

/** Several photos readers swipe through. Captions and credits come from each image. */
export const Gallery: Block = {
  slug: 'gallery',
  labels: { singular: 'Photo gallery', plural: 'Photo galleries' },
  fields: [
    {
      name: 'images',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      required: true,
      minRows: 2,
      maxRows: 20,
      admin: {
        description: 'Two to 20 photos. Each photo’s caption and credit are shown with it.',
      },
    },
    {
      name: 'title',
      type: 'text',
      admin: { description: 'Optional, e.g. “Homecoming in pictures”.' },
    },
  ],
}
