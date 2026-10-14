import type { GlobalConfig } from 'payload'

import { withPermission } from '../access'
import { auditGlobal } from '../hooks/audit'

const revalidate = async () => {
  try {
    const { revalidatePath } = await import('next/cache')
    revalidatePath('/', 'layout')
  } catch {
    // Not running inside Next.
  }
}

/** What sits at the top of the home page. Empty slots fall back to the newest stories. */
export const FrontPage: GlobalConfig = {
  slug: 'front-page',
  label: 'Front Page',
  admin: {
    group: 'Site',
    description:
      'Choose the lead story and the stories beside it. Drag to reorder. Anything left empty is filled with the newest stories.',
  },
  access: {
    read: () => true,
    update: withPermission('frontPage'),
  },
  hooks: { afterChange: [revalidate, auditGlobal('the front page')] },
  fields: [
    {
      name: 'lead',
      type: 'relationship',
      relationTo: 'articles',
      label: 'Lead story',
      filterOptions: { _status: { equals: 'published' } },
    },
    {
      name: 'featured',
      type: 'relationship',
      relationTo: 'articles',
      hasMany: true,
      maxRows: 6,
      label: 'Beside the lead',
      filterOptions: { _status: { equals: 'published' } },
      admin: { description: 'Up to six. The first three sit under the lead.' },
    },
  ],
}
