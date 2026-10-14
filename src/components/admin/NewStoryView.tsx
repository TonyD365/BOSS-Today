import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { RANK, rankOf } from '@/access'

import { TemplatePicker } from './TemplatePicker'

/** /admin/new-story — start a blank story or one from a template. */
export async function NewStoryView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req, permissions, visibleEntities, locale } = initPageResult
  const allowed = rankOf(req.user) >= RANK.reporter
  const templates = allowed
    ? (
        await req.payload.find({
          collection: 'templates',
          sort: 'name',
          limit: 100,
          depth: 0,
          overrideAccess: true,
          select: { name: true, description: true },
        })
      ).docs.map(({ id, name, description }) => ({ id, name, description: description ?? null }))
    : []

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
        {allowed ? (
          <TemplatePicker templates={templates} />
        ) : (
          <p style={{ marginTop: 40 }}>Only newsroom staff can write stories.</p>
        )}
      </Gutter>
    </DefaultTemplate>
  )
}
