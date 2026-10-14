import type { Access, FieldAccess, PayloadRequest } from 'payload'

import { superAdminEmails } from './lib/env'

export const ROLES = ['reader', 'reporter', 'editor', 'exec'] as const
export type Role = (typeof ROLES)[number]

export const PERMISSIONS = ['frontPage', 'print', 'staff', 'media'] as const
export type Permission = (typeof PERMISSIONS)[number]

/** Rank used for "only manage people below you". Super admin sits above exec. */
export const RANK = { reader: 0, reporter: 1, editor: 2, exec: 3, superAdmin: 4 } as const

type AccessUser = {
  id: number | string
  email?: string | null
  role?: Role | null
  permissions?: Permission[] | null
  active?: boolean | null
}

const asUser = (user: unknown): AccessUser | null => (user ? (user as AccessUser) : null)

export const isSuperAdminUser = (user: unknown): boolean => {
  const email = asUser(user)?.email
  return Boolean(email && superAdminEmails().includes(email.toLowerCase()))
}

/** -1 for signed-out or deactivated people. */
export const rankOf = (user: unknown): number => {
  const u = asUser(user)
  if (!u) return -1
  if (isSuperAdminUser(u)) return RANK.superAdmin
  if (u.active === false) return -1
  return RANK[u.role ?? 'reader'] ?? -1
}

export const hasPermission = (user: unknown, permission: Permission): boolean =>
  isSuperAdminUser(user) ||
  (rankOf(user) === RANK.exec && Boolean(asUser(user)?.permissions?.includes(permission)))

const userOf = (req: PayloadRequest) => req.user

export const atLeast =
  (role: keyof typeof RANK): Access =>
  ({ req }) =>
    rankOf(userOf(req)) >= RANK[role]

export const atLeastField =
  (role: keyof typeof RANK): FieldAccess =>
  ({ req }) =>
    rankOf(userOf(req)) >= RANK[role]

export const withPermission =
  (permission: Permission): Access =>
  ({ req }) =>
    hasPermission(userOf(req), permission)

export const withPermissionField =
  (permission: Permission): FieldAccess =>
  ({ req }) =>
    hasPermission(userOf(req), permission)

export const superAdminOnly: Access = ({ req }) => isSuperAdminUser(userOf(req))

export const superAdminOnlyField: FieldAccess = ({ req }) => isSuperAdminUser(userOf(req))

/** Staff see drafts; readers and the public only see published documents. */
export const publishedOrStaff: Access = ({ req }) => {
  if (rankOf(userOf(req)) >= RANK.reporter) return true
  return { _status: { equals: 'published' } }
}
