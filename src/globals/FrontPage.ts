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

/** What sits at the top of the home page. Empty slots fall back to the newest stories. */
export const FrontPage: GlobalConfig = {
  slug: 'front-page',
  label: 'Front Page',
  admin: {
    group: 'Site',
    description:
      'Choose the lead story and the stories beside it. Drag to reorder. Anything left empty is filled with the newest stories. Changes go live with the next issue.',
    components: {
      elements: {
        PublishButton: '@/components/admin/Hidden#Hidden',
        UnpublishButton: '@/components/admin/Hidden#Hidden',
      },
    },
  },
  access: {
    read: () => true,
    update: withPermission('design'),
  },
  versions: { drafts: true, max: 10 },
  hooks: {
    beforeChange: [guardGlobalPublishing('The front page')],
    afterChange: [revalidate, auditGlobal('the front page')],
  },
  fields: [
    {
      name: 'lead',
      type: 'relationship',
      relationTo: 'articles',
      label: 'Lead story',
    },
    {
      name: 'featured',
      type: 'relationship',
      relationTo: 'articles',
      hasMany: true,
      maxRows: 6,
      label: 'Beside the lead',
      admin: { description: 'Up to six. The first three sit under the lead.' },
    },
  ],
}
