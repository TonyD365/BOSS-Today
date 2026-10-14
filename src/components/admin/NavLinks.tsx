'use client'

import { useAuth } from '@payloadcms/ui'
import React from 'react'

type NavUser = { role?: string; isSuperAdmin?: boolean }

/** Extra entries in the admin sidebar, for staff. */
export function NavLinks() {
  const { user } = useAuth<NavUser>()
  if (!user || (!user.isSuperAdmin && (!user.role || user.role === 'reader'))) return null
  return (
    <div style={{ display: 'grid', gap: 4, marginTop: 16 }}>
      <a className="nav__link" href="/admin/new-story" style={link}>
        <span className="nav__link-label">+ New story</span>
      </a>
      <a className="nav__link" href="/admin/assignment-board" style={link}>
        <span className="nav__link-label">Assignment board</span>
      </a>
    </div>
  )
}

const link: React.CSSProperties = { textDecoration: 'none' }
