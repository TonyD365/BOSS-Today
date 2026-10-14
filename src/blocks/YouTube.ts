import type { Block } from 'payload'

import { youtubeId } from '../lib/youtube'

export const YouTube: Block = {
  slug: 'youtube',
  labels: { singular: 'YouTube video', plural: 'YouTube videos' },
  fields: [
    {
      name: 'url',
      type: 'text',
      required: true,
      label: 'YouTube link',
      validate: (value: unknown) =>
        (typeof value === 'string' && Boolean(youtubeId(value))) ||
        'Paste a YouTube link, e.g. https://www.youtube.com/watch?v=…',
    },
    { name: 'caption', type: 'text' },
  ],
}
