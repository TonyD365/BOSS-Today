import type { GlobalConfig } from 'payload'

import { withPermission } from '../access'
import { auditGlobal } from '../hooks/audit'
import { guardGlobalPublishing } from '../hooks/publishing'

const revalidate = async () => {
  try {
    const { revalidatePath } = await import('next/cache')
    revalidatePath('/', 'layout')
  } catch {
    // Not running inside Next.
  }
}

/** Site-wide text that editors can change without touching code. */
export const Settings: GlobalConfig = {
  slug: 'settings',
  label: 'Site Settings',
  admin: {
    group: 'Site',
    description: 'Changes go live with the next issue.',
    components: {
      elements: {
        PublishButton: '@/components/admin/Hidden#Hidden',
        UnpublishButton: '@/components/admin/Hidden#Hidden',
      },
    },
  },
  versions: { drafts: true, max: 10 },
  access: {
    read: () => true,
    update: withPermission('frontPage'),
  },
  hooks: {
    beforeChange: [guardGlobalPublishing('Site settings')],
    afterChange: [revalidate, auditGlobal('site settings')],
  },
  fields: [
    { name: 'siteName', type: 'text', required: true, defaultValue: 'BOSS Today' },
    {
      name: 'tagline',
      type: 'text',
      defaultValue: 'The student newspaper of Bur Oak Secondary School.',
    },
    {
      name: 'about',
      type: 'richText',
      label: 'About page',
      admin: { description: 'Shown at /about. Leave empty to hide the page.' },
    },
    {
      name: 'joinUs',
      type: 'richText',
      label: 'Join us',
      admin: {
        description:
          'Shown at the bottom of the Our Staff page: how to join the newsroom. Leave empty to hide it.',
      },
    },
    {
      name: 'socialLinks',
      type: 'array',
      labels: { singular: 'Link', plural: 'Social links' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'label', type: 'text', required: true, admin: { placeholder: 'Instagram' } },
            { name: 'url', type: 'text', required: true, admin: { placeholder: 'https://…' } },
          ],
        },
      ],
    },
    {
      name: 'footerNote',
      type: 'text',
      defaultValue: 'Written and edited by students.',
    },
  ],
}
