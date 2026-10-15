import type { CollectionConfig } from 'payload'

/**
 * Daily page views copied from Cloudflare Web Analytics, which only keeps
 * about six months. One row per page (or referring site) per day. Written by
 * the server only; read through the dashboard.
 */
export const PageViews: CollectionConfig = {
  slug: 'page-views',
  labels: { singular: 'Page views', plural: 'Page views' },
  admin: { hidden: true },
  access: {
    read: () => false,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'day', type: 'text', required: true, index: true },
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: [
        { label: 'Page', value: 'path' },
        { label: 'Referring site', value: 'referrer' },
      ],
    },
    { name: 'key', type: 'text', required: true, index: true },
    { name: 'views', type: 'number', required: true },
    { name: 'visits', type: 'number' },
  ],
}
