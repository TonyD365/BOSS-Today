'use client'

import { useFormFields } from '@payloadcms/ui'
import React from 'react'

import { suggestedAccess } from '@/lib/positions'

const ROLE_NAME = { reporter: 'Reporter', editor: 'Editor', exec: 'Exec' } as const
const PERMISSION_NAME = {
  issue: 'Issue',
  design: 'Design',
  print: 'Print',
  staff: 'Staff',
  media: 'Media',
} as const
const RANK = { reader: 0, reporter: 1, editor: 2, exec: 3 } as Record<string, number>

/** What access the chosen positions usually need, next to what the person has. */
export function PositionAccess() {
  const positions = useFormFields(([f]) => f.positions?.value) as string[] | undefined
  const role = useFormFields(([f]) => f.role?.value) as string | undefined
  const permissions = useFormFields(([f]) => f.permissions?.value) as string[] | undefined
  const suggested = suggestedAccess(positions ?? [])
  if (!suggested) return null
  const missing = suggested.permissions.filter((p) => !(permissions ?? []).includes(p))
  const lowRole = (RANK[role ?? 'reader'] ?? 0) < RANK[suggested.role]
  const text = `Usually needs: ${ROLE_NAME[suggested.role]}${
    suggested.permissions.length
      ? ` with ${suggested.permissions.map((p) => PERMISSION_NAME[p]).join(', ')}`
      : ''
  }.`
  return (
    <p
      style={{
        margin: '-8px 0 24px',
        fontSize: 13,
        color:
          lowRole || missing.length
            ? 'var(--theme-warning-650, var(--theme-warning-500))'
            : undefined,
      }}
    >
      {text}{' '}
      {lowRole || missing.length
        ? 'They have less than that now; the super admin can change it below. Nothing changes on its own.'
        : 'They have that.'}
    </p>
  )
}
