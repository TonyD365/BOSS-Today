import {
  APIError,
  type CollectionBeforeChangeHook,
  type CollectionConfig,
  type Where,
} from 'payload'

import {
  EDITOR_PERMISSIONS,
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
import { SESSION_SECONDS } from '../auth/session'
import { auditDelete, auditPeople, keepSignOffs } from '../hooks/audit'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate'
import { slugFrom } from '../hooks/slug'
import { POSITIONS } from '../lib/positions'

/** Roles a staff-managing exec may hand out: anything below exec. */
const STAFF_MANAGED_ROLES: Role[] = ['reader', 'reporter', 'editor']

const forbid = (message: string) => new APIError(message, 403, undefined, true)

const sameSet = (a: unknown, b: unknown) => {
  const left = new Set((a as string[] | null | undefined) ?? [])
  const right = new Set((b as string[] | null | undefined) ?? [])
  return left.size === right.size && [...left].every((item) => right.has(item))
}

/** Editors can only hold the Issue permission; reporters and readers hold none. */
const trimPermissions = (data: Record<string, unknown>, target?: Record<string, unknown>) => {
  const finalRole = (data.role ?? target?.role) as Role | undefined
  if (finalRole === 'editor') {
    data.permissions = ((data.permissions ?? target?.permissions ?? []) as Permission[]).filter(
      (permission) => EDITOR_PERMISSIONS.includes(permission),
    )
  } else if (finalRole !== 'exec') {
    data.permissions = []
  }
}

/**
 * Enforces the role rules from docs/plans/01-user-roles.md:
 * nobody changes their own role, only people above someone can change them,
 * and only the super admin appoints execs.
 */
const enforceRoleRules: CollectionBeforeChangeHook = ({
  context,
  data,
  originalDoc,
  operation,
  req,
}) => {
  const actor = req.user
  if (!actor) {
    // Without a signed-in user, only trusted server code (Google sign-in for a super
    // admin, seed scripts) may add people. This also shuts Payload's "create first
    // user" screen, which would otherwise let anyone claim an empty site.
    if (operation === 'create' && !context.trustedCreate) {
      throw forbid('New people are added by an exec.')
    }
    trimPermissions(data, originalDoc)
    return data
  }

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
  trimPermissions(data, target)
  // Deactivating someone signs them out everywhere at once.
  if (data.active === false && activeChanged) data.sessions = []

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
      'Add people here with a starting password; they can sign in with it, or with Google if their email is a Google account. When someone leaves, untick Active instead of deleting them so their bylines stay.',
  },
  auth: {
    tokenExpiration: SESSION_SECONDS,
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000,
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
    // "Force unlock" clears the 10-minute lock after five wrong passwords.
    unlock: ({ req }) => isSuperAdminUser(req.user) || canManageStaff(req.user),
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
    beforeLogin: [
      ({ user }) => {
        if (user?.active === false && !isSuperAdminUser(user)) {
          throw new APIError('This account has been deactivated.', 401, undefined, true)
        }
        return user
      },
    ],
    beforeOperation: [
      ({ operation, args }) => {
        if (operation === 'forgotPassword') {
          throw new APIError(
            'Ask an exec with the Staff permission to reset your password.',
            403,
            undefined,
            true,
          )
        }
        return args
      },
    ],
    afterChange: [revalidateAfterChange, auditPeople],
    beforeDelete: [keepSignOffs],
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
      admin: {
        description:
          'What they sign in with. Use their Gmail address if they will sign in with Google.',
      },
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
      label: 'Permissions',
      access: { update: superAdminOnlyField, create: superAdminOnlyField },
      options: PERMISSIONS.map((value) => ({
        value,
        label: (
          {
            issue: 'Issue — review and publish issues to the website (editors too)',
            design:
              'Design — the site designer, front page, sections and site settings (editors too)',
            print: 'Print — issues and print editions',
            staff: 'Staff — invite and manage reporters and editors',
            media: 'Media — manage and delete any image',
          } satisfies Record<Permission, string>
        )[value],
      })),
      admin: {
        condition: (data) => data?.role === 'exec' || data?.role === 'editor',
        description:
          'Only the super admin can change these. Editors can only hold the Issue and Design permissions.',
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
      name: 'positions',
      type: 'select',
      hasMany: true,
      label: 'Positions',
      access: {
        create: ({ req }) => isSuperAdminUser(req.user) || canManageStaff(req.user),
        update: ({ req }) => isSuperAdminUser(req.user) || canManageStaff(req.user),
      },
      options: POSITIONS.map(({ value, label }) => ({ value, label })),
      admin: {
        description:
          'Their jobs on the paper. The Our Staff page and the print staff box are grouped by these.',
      },
    },
    {
      name: 'positionAccess',
      type: 'ui',
      admin: { components: { Field: '@/components/admin/PositionAccess#PositionAccess' } },
    },
    {
      name: 'title',
      type: 'text',
      admin: {
        description:
          'Shown under the byline. Leave empty to use their positions, or write your own, e.g. "Sports Editor".',
      },
    },
    { name: 'bio', type: 'textarea' },
    { name: 'photo', type: 'upload', relationTo: 'media' },
    {
      name: 'showOnStaffPage',
      type: 'checkbox',
      label: 'Show me on the Our Staff page',
      defaultValue: true,
      admin: {
        description:
          'Your name, title, photo and bio are listed on the public Our Staff page. Untick to leave yourself off. Takes effect when the website is next rebuilt.',
      },
    },
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
