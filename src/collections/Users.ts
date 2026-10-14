import {
  APIError,
  type CollectionBeforeChangeHook,
  type CollectionConfig,
  type Where,
} from 'payload'

import {
  hasPermission,
  isSuperAdminUser,
  PERMISSIONS,
  RANK,
  rankOf,
  type Permission,
  type Role,
  superAdminOnly,
  superAdminOnlyField,
} from '../access'
import { googleSessionStrategy, SESSION_SECONDS } from '../auth/session'
import { auditDelete, auditPeople } from '../hooks/audit'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate'
import { slugFrom } from '../hooks/slug'

/** Roles a staff-managing exec may hand out: anything below exec. */
const STAFF_MANAGED_ROLES: Role[] = ['reader', 'reporter', 'editor']

const forbid = (message: string) => new APIError(message, 403, undefined, true)

const sameSet = (a: unknown, b: unknown) => {
  const left = new Set((a as string[] | null | undefined) ?? [])
  const right = new Set((b as string[] | null | undefined) ?? [])
  return left.size === right.size && [...left].every((item) => right.has(item))
}

/**
 * Enforces the role rules from docs/plans/01-user-roles.md:
 * nobody changes their own role, only people above someone can change them,
 * and only the super admin appoints execs.
 */
const enforceRoleRules: CollectionBeforeChangeHook = ({ data, originalDoc, operation, req }) => {
  const actor = req.user
  // System actions (Google sign-in, seed scripts) run without a signed-in user.
  if (!actor) return data

  const actorIsSuper = isSuperAdminUser(actor)
  const target = operation === 'update' ? originalDoc : undefined
  const roleChanged =
    operation === 'create' || (data.role !== undefined && data.role !== target?.role)
  const activeChanged = data.active !== undefined && data.active !== (target?.active ?? true)
  const permissionsChanged =
    data.permissions !== undefined && !sameSet(data.permissions, target?.permissions)

  if (target && String(target.id) === String(actor.id)) {
    if (
      (data.role !== undefined && data.role !== target.role) ||
      activeChanged ||
      permissionsChanged
    ) {
      throw forbid('You cannot change your own role, status or permissions.')
    }
    return data
  }

  if (target && isSuperAdminUser(target) && !actorIsSuper) {
    throw forbid('Only the super admin can change a super admin.')
  }

  if (roleChanged || activeChanged) {
    if (!actorIsSuper) {
      if (!hasPermission(actor, 'staff')) {
        throw forbid('You need the Staff permission to manage people.')
      }
      const nextRole = (data.role ?? target?.role ?? 'reporter') as Role
      const currentRole = target?.role as Role | undefined
      if (
        !STAFF_MANAGED_ROLES.includes(nextRole) ||
        (currentRole && !STAFF_MANAGED_ROLES.includes(currentRole))
      ) {
        throw forbid('Only the super admin can appoint or change execs.')
      }
    }
  }

  if (permissionsChanged && !actorIsSuper) {
    throw forbid('Only the super admin can assign exec permissions.')
  }
  if ((data.role ?? target?.role) !== 'exec') data.permissions = []

  return data
}

const canManageStaff = (user: unknown) => hasPermission(user, 'staff')

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Person', plural: 'People' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'role', 'active'],
    group: 'Admin',
    description:
      'Staff are invited by adding their school Google address here; they then sign in with Google. When someone leaves, untick Active instead of deleting them so their bylines stay.',
  },
  auth: {
    disableLocalStrategy: true,
    strategies: [googleSessionStrategy],
    tokenExpiration: SESSION_SECONDS,
    cookies: { sameSite: 'Lax', secure: process.env.NODE_ENV === 'production' },
  },
  access: {
    admin: ({ req }) => rankOf(req.user) >= RANK.reporter,
    read: ({ req }) => {
      const rank = rankOf(req.user)
      if (rank >= RANK.reporter) return true
      if (req.user) return { id: { equals: req.user.id } }
      return false
    },
    create: ({ req }) => isSuperAdminUser(req.user) || canManageStaff(req.user),
    update: ({ req }) => {
      if (!req.user || rankOf(req.user) < 0) return false
      if (isSuperAdminUser(req.user)) return true
      if (canManageStaff(req.user)) {
        const selfOrJuniors: Where = {
          or: [{ id: { equals: req.user.id } }, { role: { in: STAFF_MANAGED_ROLES } }],
        }
        return selfOrJuniors
      }
      return { id: { equals: req.user.id } }
    },
    delete: superAdminOnly,
  },
  hooks: {
    beforeValidate: [
      slugFrom('name'),
      ({ data }) => {
        if (data?.email) data.email = String(data.email).trim().toLowerCase()
        return data
      },
    ],
    beforeChange: [enforceRoleRules],
    afterChange: [revalidateAfterChange, auditPeople],
    afterDelete: [revalidateAfterDelete, auditDelete('person')],
  },
  fields: [
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
      index: true,
      access: {
        update: ({ req }) => isSuperAdminUser(req.user) || canManageStaff(req.user),
      },
      admin: { description: 'Their school Google address, e.g. 123456@gapps.yrdsb.ca.' },
    },
    { name: 'name', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        {
          name: 'role',
          type: 'select',
          required: true,
          defaultValue: 'reporter',
          options: [
            { label: 'Reader', value: 'reader' },
            { label: 'Reporter', value: 'reporter' },
            { label: 'Editor', value: 'editor' },
            { label: 'Exec', value: 'exec' },
          ],
          admin: {
            description:
              'Reporters write; editors review and publish; execs also get the permissions below.',
          },
        },
        {
          name: 'active',
          type: 'checkbox',
          defaultValue: true,
          admin: { description: 'Untick when someone leaves. They can no longer sign in.' },
        },
      ],
    },
    {
      name: 'permissions',
      type: 'select',
      hasMany: true,
      label: 'Exec permissions',
      access: { update: superAdminOnlyField, create: superAdminOnlyField },
      options: PERMISSIONS.map((value) => ({
        value,
        label: (
          {
            frontPage: 'Front page — lead stories and sections',
            print: 'Print — issues and print editions',
            staff: 'Staff — invite and manage reporters and editors',
            media: 'Media — manage and delete any image',
          } satisfies Record<Permission, string>
        )[value],
      })),
      admin: {
        condition: (data) => data?.role === 'exec',
        description: 'Only the super admin can change these.',
      },
    },
    {
      name: 'isSuperAdmin',
      type: 'checkbox',
      virtual: true,
      label: 'Super admin',
      access: { create: () => false, update: () => false },
      hooks: { afterRead: [({ data }) => isSuperAdminUser(data)] },
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Set in the deployment settings (SUPER_ADMIN_EMAILS), not here.',
      },
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
