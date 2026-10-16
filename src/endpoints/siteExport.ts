import { timingSafeEqual } from 'crypto'
import type { Endpoint, PayloadRequest, Where } from 'payload'

import type { Article, Media, User } from '../payload-types'

const json = (body: unknown, status = 200) => Response.json(body, { status })

export const EXPORT_PAGE_SIZE = 40

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

/** Only what a reader may see of a staff member. */
const publicAuthor = (user: User | number | null | undefined) =>
  user && typeof user === 'object'
    ? {
        id: user.id,
        name: user.name,
        title: user.title ?? null,
        bio: user.bio ?? null,
        slug: user.slug ?? null,
        photo: user.photo && typeof user.photo === 'object' ? (user.photo as Media) : null,
      }
    : null

const published: Where = { _status: { equals: 'published' } }

const idOf = (value: unknown) =>
  value && typeof value === 'object' ? (value as { id: number }).id : (value as number)

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
    const { payload } = req
    const origin = originOf(req)
    const part = req.searchParams.get('part') ?? 'meta'

    if (part === 'articles') {
      const page = Math.max(1, Number(req.searchParams.get('page')) || 1)
      const liveTags = await payload.find({
        collection: 'tags',
        where: published,
        limit: 0,
        pagination: false,
        depth: 0,
        overrideAccess: true,
        select: { name: true, slug: true },
      })
      const tagsById = new Map(liveTags.docs.map((tag) => [tag.id, tag]))
      const result = await payload.find({
        collection: 'articles',
        where: published,
        sort: '-publishedAt',
        depth: 2,
        limit: EXPORT_PAGE_SIZE,
        page,
        overrideAccess: true,
      })
      const docs = result.docs.map((article: Article) => ({
        id: article.id,
        title: article.title,
        slug: article.slug,
        summary: article.summary,
        content: article.content,
        publishedAt: article.publishedAt,
        updatedAt: article.updatedAt,
        _status: article._status,
        heroImage:
          article.heroImage && typeof article.heroImage === 'object' ? article.heroImage : null,
        section:
          article.section && typeof article.section === 'object'
            ? { id: article.section.id, name: article.section.name, slug: article.section.slug }
            : null,
        // A letter or guest piece is credited to its writer, not the staff who handled it.
        authors: article.guestByline?.trim()
          ? [
              {
                id: 0,
                name: article.guestByline.trim(),
                title: null,
                bio: null,
                slug: null,
                photo: null,
              },
            ]
          : (article.authors ?? []).map(publicAuthor).filter(Boolean),
        // Only tags that have themselves gone live.
        tags: (article.tags ?? [])
          .map((tag) => tagsById.get(idOf(tag)))
          .filter((tag) => tag !== undefined)
          .map((tag) => ({ id: tag.id, name: tag.name, slug: tag.slug })),
        corrections: (article.corrections ?? []).map(({ date, text }) => ({ date, text })),
      }))
      return json(absolutize({ page, totalPages: result.totalPages, docs }, origin))
    }

    const [settings, frontPage, sections, tags, issues, staff] = await Promise.all([
      payload.findGlobal({ slug: 'settings', depth: 1, overrideAccess: true }),
      payload.findGlobal({ slug: 'front-page', depth: 0, overrideAccess: true }),
      payload.find({
        collection: 'sections',
        where: published,
        sort: 'order',
        limit: 100,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'tags',
        where: published,
        sort: 'name',
        limit: 0,
        pagination: false,
        depth: 1,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'issues',
        where: published,
        sort: '-date',
        depth: 0,
        limit: 500,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'users',
        where: {
          and: [
            { role: { in: ['reporter', 'editor', 'exec'] } },
            { active: { not_equals: false } },
            { showOnStaffPage: { not_equals: false } },
          ],
        },
        sort: 'name',
        limit: 500,
        depth: 1,
        overrideAccess: true,
      }),
    ])

    return json(
      absolutize(
        {
          generatedAt: new Date().toISOString(),
          cmsUrl: origin,
          settings: {
            siteName: settings.siteName || 'BOSS Today',
            tagline: settings.tagline || 'The student newspaper of Bur Oak Secondary School.',
            about: settings.about ?? null,
            socialLinks: (settings.socialLinks ?? []).map(({ label, url }) => ({ label, url })),
            footerNote: settings.footerNote ?? '',
            joinUs: settings.joinUs ?? null,
          },
          frontPage: {
            lead:
              typeof frontPage.lead === 'object'
                ? (frontPage.lead?.id ?? null)
                : (frontPage.lead ?? null),
            featured: (frontPage.featured ?? []).map((item) =>
              typeof item === 'object' ? item.id : item,
            ),
          },
          // Public profile fields only, grouped on the Our Staff page by role.
          staff: staff.docs.map((user) => ({ ...publicAuthor(user)!, role: user.role })),
          tags: tags.docs.map(({ id, name, slug, description, image }) => ({
            id,
            name,
            slug,
            description: description ?? null,
            image: image && typeof image === 'object' ? image : null,
          })),
          sections: sections.docs.map(({ id, name, slug, description, order }) => ({
            id,
            name,
            slug,
            description: description ?? null,
            order: order ?? 0,
          })),
          issues: issues.docs.map((issue) => ({
            id: issue.id,
            title: issue.title,
            volume: issue.volume,
            number: issue.number,
            date: issue.date,
            printEdition: Boolean(issue.printEdition),
            stories: (issue.stories ?? []).map((story) =>
              typeof story.article === 'object' ? story.article?.id : story.article,
            ),
            // How the print edition is laid out; the site build typesets it and makes the PDF.
            print: issue.printEdition
              ? {
                  paperSize: issue.paperSize ?? 'letter',
                  showContents: issue.showContents !== false,
                  showStaffBox: issue.showStaffBox !== false,
                  announcement: issue.announcement ?? null,
                  stories: (issue.stories ?? []).map((story) => ({
                    id: typeof story.article === 'object' ? story.article?.id : story.article,
                    width: story.width ?? 'full',
                    showImage: story.showImage !== false,
                  })),
                }
              : null,
          })),
        },
        origin,
      ),
    )
  },
}
