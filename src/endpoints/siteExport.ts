import { timingSafeEqual } from 'crypto'
import type { Endpoint, PayloadRequest } from 'payload'

import { exportArticles, exportMeta } from '../publishing/siteContent'
import { publicizeMedia } from '../storage/publicImages'

const json = (body: unknown, status = 200) => Response.json(body, { status })

export { EXPORT_PAGE_SIZE } from '../publishing/siteContent'

const authorized = (req: PayloadRequest) => {
  const expected = process.env.SITE_EXPORT_TOKEN?.trim()
  const given = req.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '')
    .trim()
  if (!expected || !given || expected.length !== given.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(given))
}

const originOf = (req: PayloadRequest) => {
  if (process.env.CMS_URL) return process.env.CMS_URL.replace(/\/$/, '')
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  return `${proto}://${host}`
}

/** Files stored on this server are linked with a full address so the static site can load them. */
const absolutize = <T>(value: T, origin: string): T => {
  if (typeof value === 'string') {
    return (value.startsWith('/api/') ? `${origin}${value}` : value) as T
  }
  if (Array.isArray(value)) return value.map((item) => absolutize(item, origin)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, absolutize(item, origin)]),
    ) as T
  }
  return value
}

/** Images point at the public image repository when there is one, else at this server. */
const forReaders = <T>(value: T, origin: string): T => absolutize(publicizeMedia(value), origin)

/**
 * GET /api/site-export?part=meta
 * GET /api/site-export?part=articles&page=N
 *
 * Everything the public site shows, and nothing else, for the Cloudflare Pages
 * build. Protected by SITE_EXPORT_TOKEN.
 */
export const siteExportEndpoint: Endpoint = {
  path: '/site-export',
  method: 'get',
  handler: async (req) => {
    if (!authorized(req)) return json({ message: 'Unauthorized.' }, 401)
    const origin = originOf(req)
    if ((req.searchParams.get('part') ?? 'meta') === 'articles') {
      const page = Math.max(1, Number(req.searchParams.get('page')) || 1)
      return json(forReaders(await exportArticles(req.payload, page), origin))
    }
    return json(forReaders(await exportMeta(req.payload, origin), origin))
  },
}
