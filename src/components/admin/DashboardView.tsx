import { Gutter } from '@payloadcms/ui'
import type { Payload, TypedUser } from 'payload'
import React from 'react'

import { Dashboard } from './Dashboard'

/**
 * Replaces Payload's customizable widget dashboard (with its "Edit Dashboard"
 * menu) by a fixed one: what each person needs to do next. Payload already
 * wraps this in the admin layout, so it renders only the page body.
 */
export function DashboardView({ payload, user }: { payload: Payload; user?: TypedUser | null }) {
  return (
    <Gutter>
      <div style={{ marginTop: 32 }}>
        <Dashboard payload={payload} user={user} />
      </div>
    </Gutter>
  )
}
