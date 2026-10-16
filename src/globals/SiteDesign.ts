import { APIError, type GlobalBeforeChangeHook, type GlobalConfig } from 'payload'

import { RANK, rankOf } from '../access'
import { cleanDesign, contrastProblems } from '../design/sanitize'
import {
  assertDesignLock,
  canDesign,
  designLockEndpoint,
  designPreviewEndpoint,
  publishDesignNowEndpoint,
} from '../endpoints/siteDesign'
import { auditGlobal } from '../hooks/audit'
import { guardGlobalPublishing } from '../hooks/publishing'

/**
 * Every save is cleaned to what the renderer understands, and refused if text
 * would be hard to read. Changing the desktop canvas is noted, so the issue
 * checklist can ask whether the phone layout was looked at since.
 */
const checkDesign: GlobalBeforeChangeHook = async ({ data, originalDoc, req, context }) => {
  if (data.design === undefined) return data
  if (!context.issuePublish) await assertDesignLock(req)
  const design = cleanDesign(data.design)
  if (!context.issuePublish) {
    const problems = contrastProblems(design)
    if (problems.length > 0) {
      const first = problems[0]
      throw new APIError(
        `Some text is hard to read: “${first.label}” on ${first.view} has contrast ${first.ratio}:1 (needs ${first.needed}:1). Try ${first.suggestion}.`,
        400,
        { problems },
        true,
      )
    }
  }
  const before = cleanDesign(originalDoc?.design)
  if (JSON.stringify(before.desktop) !== JSON.stringify(design.desktop)) {
    design.desktopChangedAt = new Date().toISOString()
  }
  data.design = design
  return data
}

/** The front page, designed on a free canvas (see src/design). */
export const SiteDesign: GlobalConfig = {
  slug: 'site-design',
  label: 'Site Design',
  admin: {
    group: 'Site',
    description:
      'The designed front page. Open the designer to change it. Saved changes go live with the next issue. Until a design is published, the site uses the classic front page.',
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
  ],
}
