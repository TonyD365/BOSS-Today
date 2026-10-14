import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { canPublishIssues } from '@/access'

import { PublishChecklist } from './PublishChecklist'

/** /admin/publish-issue?id=… — read every waiting story, sign off, publish. */
export function PublishIssue({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req, permissions, visibleEntities, locale } = initPageResult
  const id = typeof searchParams?.id === 'string' ? searchParams.id : undefined

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={req.payload}
      permissions={permissions}
      searchParams={searchParams}
      user={req.user ?? undefined}
      visibleEntities={visibleEntities}
    >
      <Gutter>
        {!canPublishIssues(req.user) ? (
          <p style={{ marginTop: 40 }}>You need the Issue permission to publish issues.</p>
        ) : !id ? (
          <p style={{ marginTop: 40 }}>
            Open an issue and choose “Review &amp; publish this issue”.
          </p>
        ) : (
          <PublishChecklist issueId={id} />
        )}
      </Gutter>
    </DefaultTemplate>
  )
}
