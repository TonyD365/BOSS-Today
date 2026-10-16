import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { canPublishIssues, hasPermission, RANK, rankOf } from '@/access'
import { classicDesign } from '@/design/defaults'
import { cleanDesign } from '@/design/sanitize'

import { Designer } from './Designer'

/**
 * /admin/site-designer — the front page on a free canvas. Opens the latest
 * draft; with nothing saved yet, starts from the classic front page.
 */
export async function SiteDesignerView({
  initPageResult,
  params,
  searchParams,
}: AdminViewServerProps) {
  const { req, permissions, visibleEntities, locale } = initPageResult
  const allowed = rankOf(req.user) >= RANK.reporter
  let body: React.ReactNode = (
    <p style={{ marginTop: 40 }}>Only newsroom staff can open the designer.</p>
  )
  if (allowed) {
    const global = await req.payload.findGlobal({
      slug: 'site-design',
      draft: true,
      depth: 0,
      overrideAccess: true,
    })
    let design = global.design ? cleanDesign(global.design) : null
    if (!design || design.desktop.elements.length === 0) {
      const sections = await req.payload.find({
        collection: 'sections',
        where: { _status: { equals: 'published' } },
        sort: 'order',
        limit: 4,
        depth: 0,
        overrideAccess: true,
      })
      design = classicDesign(sections.docs.map(({ id, name }) => ({ id, name })))
    }
    body = (
      <Designer
        initial={design}
        published={global._status === 'published'}
        saved={Boolean(global.design)}
        canEdit={hasPermission(req.user, 'design')}
        canPublishNow={canPublishIssues(req.user)}
      />
    )
  }
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
      {body}
    </DefaultTemplate>
  )
}
