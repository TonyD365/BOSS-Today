import type { Access, FieldAccess, PayloadRequest } from 'payload'

export type Role = 'admin' | 'editor' | 'writer'

const roleOf = (req: PayloadRequest): Role | undefined => (req.user as { role?: Role } | null)?.role

export const isStaff: Access = ({ req }) => Boolean(req.user)

export const isAdmin: Access = ({ req }) => roleOf(req) === 'admin'

export const isEditor: Access = ({ req }) => {
  const role = roleOf(req)
  return role === 'admin' || role === 'editor'
}

export const isAdminField: FieldAccess = ({ req }) => roleOf(req) === 'admin'

export const isEditorField: FieldAccess = ({ req }) => {
  const role = roleOf(req)
  return role === 'admin' || role === 'editor'
}

/** Staff see everything; the public only sees published documents. */
export const publishedOrStaff: Access = ({ req }) => {
  if (req.user) return true
  return { _status: { equals: 'published' } }
}
