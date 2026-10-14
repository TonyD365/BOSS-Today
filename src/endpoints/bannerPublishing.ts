import { APIError, type Endpoint } from 'payload'

import { canPublishIssues } from '../access'
import { audit } from '../hooks/audit'
import { publicBanner, storeBanner } from '../publishing/banner'

const json = (body: unknown, status = 200) => Response.json(body, { status })

/**
 * POST /api/globals/banner/publish-now  { reason }
 *
 * Puts the saved banner on the website straight away. It is stored in
 * Cloudflare KV, so no rebuild is needed and none is counted. Waiting stories
 * and other drafts still wait for the next issue.
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
      // With no unpublished change this sends the published banner again, which
      // repairs the website's copy if an earlier attempt didn't get through.
      const resend = draft._status !== 'draft'

      // Readers' copy first: if Cloudflare refuses it, nothing is marked as published.
      await storeBanner(publicBanner(draft))
      if (!resend) {
        await req.payload.updateGlobal({
          slug: 'banner',
          data: { _status: 'published' },
          req,
          overrideAccess: true,
          context: { issuePublish: true },
        })
      }
      const text = draft.text?.trim()
      await audit(req, {
        action: 'publish',
        summary: `${resend ? 'Re-sent' : text ? 'Published' : 'Removed'} the banner${text ? ` “${text}”` : ''} straight away: ${reason}`,
        target: 'global:banner',
      })
      return json({ ok: true, resent: resend })
    } catch (error) {
      return json(
        { message: error instanceof Error ? error.message : 'Something went wrong.' },
        error instanceof APIError ? error.status : 400,
      )
    }
  },
}
