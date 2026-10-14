import { APIError, type Endpoint } from 'payload'

import { canPublishIssues } from '../access'
import { audit } from '../hooks/audit'
import { assertDeployBudget, triggerDeploy } from '../publishing/deploy'

const json = (body: unknown, status = 200) => Response.json(body, { status })

/**
 * POST /api/globals/banner/publish-now  { reason }
 *
 * Puts the saved banner on the website straight away. Only the banner goes
 * live: waiting stories and other drafts still wait for the next issue.
 */
export const publishBannerNowEndpoint: Endpoint = {
  path: '/publish-now',
  method: 'post',
  handler: async (req) => {
    if (!canPublishIssues(req.user)) return json({ message: 'You need the Issue permission.' }, 403)
    const body = (req.json ? await req.json().catch(() => ({})) : {}) as { reason?: string }
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : ''
    if (!reason) return json({ message: 'Say why this can’t wait for the next issue.' }, 400)

    try {
      const draft = await req.payload.findGlobal({
        slug: 'banner',
        draft: true,
        depth: 0,
        overrideAccess: true,
        req,
      })
      if (draft._status !== 'draft') {
        return json({ message: 'The banner on the website is already up to date.' }, 409)
      }

      await assertDeployBudget(req.payload, 'issue', req)
      await req.payload.updateGlobal({
        slug: 'banner',
        data: { _status: 'published' },
        req,
        overrideAccess: true,
        context: { issuePublish: true },
      })
      const summary = draft.text?.trim()
        ? `Published the banner “${draft.text.trim()}” straight away: ${reason}`
        : `Removed the banner straight away: ${reason}`
      await audit(req, { action: 'publish', summary, target: 'global:banner' })

      const deploy = await triggerDeploy(req, { reason: 'banner', note: reason })
      return json({ ok: true, deploy })
    } catch (error) {
      return json(
        { message: error instanceof Error ? error.message : 'Something went wrong.' },
        error instanceof APIError ? error.status : 400,
      )
    }
  },
}
