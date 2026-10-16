import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { canPublishIssues, hasPermission, RANK, rankOf } from '@/access'
import {
  classicDesign,
  classicFooter,
  classicHeader,
  emptyDesign,
  pageStarter,
} from '@/design/defaults'
import { cleanDesign, cleanTemplate, cleanTemplates } from '@/design/sanitize'
import {
  type Design,
  SIDE_WIDTH,
  TEMPLATE_KINDS,
  TEMPLATE_SLOTS,
  type TemplateKind,
  type TemplateSlot,
} from '@/design/types'

import { Designer, type Target } from './Designer'

const designed = (value: unknown): Design | null => {
  if (!value) return null
  const design = cleanDesign(value)
  return design.desktop.elements.length > 0 ? design : null
}

/**
 * /admin/site-designer — the site on a free canvas. ?part=header or footer
 * opens those, ?page=<id> a custom page, and otherwise the front page. Opens
 * the latest draft; with nothing saved yet, starts from the classic look.
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
    const part = String(searchParams?.part ?? '')
    const kind = String(searchParams?.template ?? '') as TemplateKind
    const slot = (
      TEMPLATE_SLOTS.includes(searchParams?.slot as TemplateSlot) ? searchParams?.slot : 'above'
    ) as TemplateSlot
    const pageId = Number(searchParams?.page)
    const global = await req.payload.findGlobal({
      slug: 'site-design',
      draft: true,
      depth: 0,
      overrideAccess: true,
    })
    const templates = cleanTemplates(global.templates)
    const header = designed(global.header)
    const footer = designed(global.footer)
    let target: Target
    let design: Design | null
    let published = global._status === 'published'
    // The other half of the header and footer, for the rules about what they must keep.
    let other: Design | null = null
    if (pageId) {
      const page = await req.payload
        .findByID({ collection: 'pages', id: pageId, draft: true, depth: 0, overrideAccess: true })
        .catch(() => null)
      if (!page) {
        body = <p style={{ marginTop: 40 }}>That page doesn’t exist any more.</p>
        return wrap(body)
      }
      target = { kind: 'page', id: page.id, title: page.title }
      design = designed(page.design)
      published = page._status === 'published'
    } else if (TEMPLATE_KINDS.includes(kind)) {
      target = { kind: 'template', template: kind, slot }
      design = templates[kind]?.[slot] ?? null
    } else if (part === 'header' || part === 'footer') {
      target = { kind: 'global', field: part }
      design = part === 'header' ? header : footer
      other = part === 'header' ? footer : header
    } else {
      target = { kind: 'global', field: 'design' }
      design = designed(global.design)
    }
    const saved = Boolean(design)
    if (!design) {
      if (target.kind === 'global' && target.field === 'header') design = classicHeader()
      else if (target.kind === 'global' && target.field === 'footer') design = classicFooter()
      else if (target.kind === 'page') design = pageStarter(target.title)
      else if (target.kind === 'template') {
        design = emptyDesign()
        design.desktop.height = target.slot === 'side' ? 600 : 240
        if (target.slot === 'side') design.desktop.width = SIDE_WIDTH
      } else {
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
    }
    body = (
      <Designer
        key={
          target.kind === 'page'
            ? `page-${target.id}`
            : target.kind === 'template'
              ? `${target.template}-${target.slot}`
              : target.field
        }
        templates={templates}
        template={target.kind === 'template' ? cleanTemplate(templates[target.template]) : null}
        target={target}
        other={other}
        initial={design}
        published={published}
        saved={saved}
        canEdit={hasPermission(req.user, 'design')}
        canPublishNow={canPublishIssues(req.user)}
      />
    )
  }
  return wrap(body)

  function wrap(content: React.ReactNode) {
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
        {content}
      </DefaultTemplate>
    )
  }
}
