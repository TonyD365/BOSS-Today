import { timingSafeEqual } from 'crypto'
import type { Endpoint } from 'payload'

import { RANK, rankOf } from '../access'
import { storyViews, syncReadership } from '../publishing/readership'
import { cleanupSubmissions } from './submissions'

const json = (body: unknown, status = 200) => Response.json(body, { status })

/**
 * GET /api/cron/daily — run by Vercel Cron once a day (see vercel.json) with
 * `Authorization: Bearer $CRON_SECRET`. Copies readership from Cloudflare,
 * refreshes Most read, and clears old submission data.
 */
export const dailyCronEndpoint: Endpoint = {
  path: '/cron/daily',
  method: 'get',
  handler: async (req) => {
    const expected = process.env.CRON_SECRET?.trim()
    const given = req.headers
      .get('authorization')
      ?.replace(/^Bearer\s+/i, '')
      .trim()
    if (
      !expected ||
      !given ||
      expected.length !== given.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(given))
    ) {
      return json({ message: 'Unauthorized.' }, 401)
    }
    const readership = await syncReadership(req.payload, { force: true })
    await cleanupSubmissions(req.payload)
    return json({ ok: true, readership })
  },
}

/** GET /api/articles/:id/views — all-time views of one published story. */
export const storyViewsEndpoint: Endpoint = {
  path: '/:id/views',
  method: 'get',
  handler: async (req) => {
    const user = req.user
    if (!user || rankOf(user) < RANK.reporter) return json({ message: 'Sign in first.' }, 401)
    const story = await req.payload.findByID({
      collection: 'articles',
      id: req.routeParams?.id as string,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      select: { slug: true, authors: true, _status: true },
    })
    if (!story) return json({ message: 'Story not found.' }, 404)
    const isAuthor = (story.authors ?? []).some(
      (author) => String(typeof author === 'object' ? author.id : author) === String(user.id),
    )
    if (!isAuthor && rankOf(user) < RANK.editor) {
      return json({ message: 'Only the authors and editors can see this.' }, 403)
    }
    if (story._status !== 'published' || !story.slug) return json({ views: null })
    return json({ views: await storyViews(req.payload, story.slug) })
  },
}
