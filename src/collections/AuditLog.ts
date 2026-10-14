import type { CollectionConfig } from 'payload'

import { isSuperAdminUser, superAdminOnly } from '../access'

/** Who published, withdrew, deleted or changed whom, and when. Written by hooks only. */
export const AuditLog: CollectionConfig = {
  slug: 'audit-log',
  labels: { singular: 'Log entry', plural: 'Activity log' },
  admin: {
    useAsTitle: 'summary',
    defaultColumns: ['summary', 'actor', 'createdAt'],
    group: 'Admin',
    hidden: ({ user }) => !isSuperAdminUser(user),
    description:
      'Every publish, withdrawal, deletion and staff change. Visible to the super admin only.',
  },
  defaultSort: '-createdAt',
  access: {
    read: superAdminOnly,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'summary', type: 'text', required: true },
    {
      name: 'action',
      type: 'select',
      required: true,
      index: true,
      options: [
        'publish',
        'withdraw',
        'delete',
        'invite',
        'role',
        'deactivate',
        'reactivate',
        'settings',
      ],
    },
    { name: 'actor', type: 'relationship', relationTo: 'users', admin: { allowCreate: false } },
    { name: 'target', type: 'text', index: true },
  ],
}
