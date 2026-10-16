import { APIError, type GlobalBeforeChangeHook, type GlobalConfig } from 'payload'

import { RANK, rankOf } from '../access'
import { chromeProblems, cleanTemplates } from '../design/sanitize'
import { TEMPLATE_KINDS, TEMPLATE_SLOTS } from '../design/types'
import { prepareDesign, storedDesign } from '../design/save'
import {
  assertDesignLock,
  canDesign,
  designLockEndpoint,
  designPreviewEndpoint,
  publishDesignNowEndpoint,
} from '../endpoints/siteDesign'
import { auditGlobal } from '../hooks/audit'
import { guardGlobalPublishing } from '../hooks/publishing'

/** The three canvases the designer keeps here. */
const PARTS = [
  ['design', 'Front page'],
  ['header', 'Header'],
  ['footer', 'Footer'],
] as const

const checkDesign: GlobalBeforeChangeHook = async ({ data, originalDoc, req, context }) => {
  if (PARTS.every(([field]) => data[field] === undefined) && data.templates === undefined)
    return data
  const check = !context.issuePublish
  if (check) await assertDesignLock(req)
  for (const [field, label] of PARTS) {
    if (data[field] === undefined || data[field] === null) continue
    data[field] = prepareDesign(data[field], originalDoc?.[field], check, label)
  }
  if (data.templates !== undefined && data.templates !== null) {
    const before = cleanTemplates(originalDoc?.templates)
    const templates = cleanTemplates(data.templates)
    for (const kind of TEMPLATE_KINDS) {
      const t = templates[kind]
      if (!t) continue
      for (const slot of TEMPLATE_SLOTS) {
        if (!t[slot]) continue
        const label = `The ${kind === 'other' ? 'other pages' : kind} template (${slot})`
        t[slot] = prepareDesign(t[slot], before[kind]?.[slot], check, label)
      }
    }
    data.templates = templates
  }
  if (check) {
    const header = storedDesign(data.header === undefined ? originalDoc?.header : data.header)
    const footer = storedDesign(data.footer === undefined ? originalDoc?.footer : data.footer)
    const problems = chromeProblems(header, footer)
    if (problems.length > 0) throw new APIError(problems.join(' '), 400, undefined, true)
  }
  return data
}

/** The front page, header and footer, designed on a free canvas (see src/design). */
export const SiteDesign: GlobalConfig = {
  slug: 'site-design',
  label: 'Site Design',
  admin: {
    group: 'Site',
    description:
      'The designed front page, header, footer and page templates. Open the designer to change them. Saved changes go live with the next issue. Anything not designed yet keeps its classic look.',
    components: {
      elements: {
        PublishButton: '@/components/admin/Hidden#Hidden',
        UnpublishButton: '@/components/admin/Hidden#Hidden',
      },
    },
  },
  versions: { drafts: true, max: 10 },
  endpoints: [designPreviewEndpoint, designLockEndpoint, publishDesignNowEndpoint],
  access: {
    read: ({ req }) => rankOf(req.user) >= RANK.reporter,
    update: ({ req }) => canDesign(req.user),
  },
  hooks: {
    beforeChange: [guardGlobalPublishing('The site design'), checkDesign],
    afterChange: [auditGlobal('site design')],
  },
  fields: [
    {
      name: 'designer',
      type: 'ui',
      admin: { components: { Field: '@/components/admin/designer/DesignSummary#DesignSummary' } },
    },
    { name: 'design', type: 'json', admin: { hidden: true } },
    { name: 'header', type: 'json', admin: { hidden: true } },
    { name: 'footer', type: 'json', admin: { hidden: true } },
    { name: 'templates', type: 'json', admin: { hidden: true } },
  ],
}
