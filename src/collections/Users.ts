import type { CollectionConfig } from 'payload'

import { isAdmin, isAdminField, isStaff } from '../access'
import { googleSessionStrategy, SESSION_SECONDS } from '../auth/session'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate'
import { slugFrom } from '../hooks/slug'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Staff member', plural: 'Staff' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'role'],
    description:
      'Only people listed here can sign in. Add a staff member with their school Google address, then they sign in with Google.',
  },
  auth: {
    disableLocalStrategy: true,
    strategies: [googleSessionStrategy],
    tokenExpiration: SESSION_SECONDS,
    cookies: { sameSite: 'Lax', secure: process.env.NODE_ENV === 'production' },
  },
  access: {
    admin: ({ req }) => Boolean(req.user),
    read: isStaff,
    create: isAdmin,
    delete: isAdmin,
    update: ({ req }) => {
      if (!req.user) return false
      if ((req.user as { role?: string }).role === 'admin') return true
      return { id: { equals: req.user.id } }
    },
  },
  hooks: {
    beforeValidate: [
      slugFrom('name'),
      ({ data }) => {
        if (data?.email) data.email = String(data.email).trim().toLowerCase()
        return data
      },
    ],
    afterChange: [revalidateAfterChange],
    afterDelete: [revalidateAfterDelete],
  },
  fields: [
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
      index: true,
      access: { update: isAdminField },
    },
    { name: 'name', type: 'text', required: true },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'writer',
      access: { create: isAdminField, update: isAdminField },
      options: [
        { label: 'Admin — manages staff and everything else', value: 'admin' },
        { label: 'Editor — reviews, publishes, builds issues', value: 'editor' },
        { label: 'Writer — writes and submits drafts', value: 'writer' },
      ],
    },
    {
      name: 'title',
      type: 'text',
      admin: { description: 'Shown under the byline, e.g. "Sports Editor" or "Staff Writer".' },
    },
    { name: 'bio', type: 'textarea' },
    { name: 'photo', type: 'upload', relationTo: 'media' },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: { position: 'sidebar', description: 'Used in the author page address.' },
    },
    {
      name: 'googleId',
      type: 'text',
      index: true,
      access: { create: () => false, update: () => false },
      admin: { hidden: true },
    },
  ],
}
