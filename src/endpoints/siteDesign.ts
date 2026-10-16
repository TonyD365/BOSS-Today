import { APIError, type Endpoint, type Payload, type PayloadRequest } from 'payload'

import { canPublishIssues, hasPermission, RANK, rankOf } from '../access'
import type { DArticle, DesignData } from '../design/render'
import { siteInfo } from '../design/siteInfo'
import { audit } from '../hooks/audit'
import { buildBoard } from '../publishing/board'
import { assertDeployBudget, triggerDeploy } from '../publishing/deploy'
import { mostReadStories } from '../publishing/readership'
import type { Article, Media } from '../payload-types'

const json = (body: unknown, status = 200) => Response.json(body, { status })

/** Only one person edits the design at a time; the lock lapses if they go quiet. */
const LOCK_KEY = 'site-design:lock'
const LOCK_MS = 2 * 60 * 1000

type Lock = { userId: string; name: string; at: string }

export const canDesign = (user: unknown) => hasPermission(user, 'design')

export const currentLock = async (payload: Payload): Promise<Lock | null> => {
  const lock = await payload.kv.get<Lock>(LOCK_KEY)
  return lock && Date.now() - new Date(lock.at).getTime() < LOCK_MS ? lock : null
}

/** Refuses a save while someone else holds the lock. */
export const assertDesignLock = async (req: PayloadRequest) => {
  const lock = await currentLock(req.payload)
  if (lock && req.user && lock.userId !== String(req.user.id)) {
    throw new APIError(
      `${lock.name} is editing the site design right now. Wait for them to finish, or take over in the designer.`,
      423,
      undefined,
      true,
    )
  }
}

/**
 * POST /api/globals/site-design/lock  { release?, takeOver? }
 * Claims or renews the editing lock (the designer calls it every 30 seconds).
 */
export const designLockEndpoint: Endpoint = {
  path: '/lock',
  method: 'post',
  handler: async (req) => {
    if (!req.user || !canDesign(req.user))
      return json({ message: 'You need the Design permission.' }, 403)
    const body = (req.json ? await req.json().catch(() => ({})) : {}) as {
      release?: boolean
      takeOver?: boolean
    }
    const me = String(req.user.id)
    const lock = await currentLock(req.payload)
    if (body.release) {
      if (lock?.userId === me) await req.payload.kv.delete(LOCK_KEY)
      return json({ ok: true })
    }
    if (lock && lock.userId !== me && !body.takeOver) {
      return json({ ok: false, heldBy: lock.name, since: lock.at }, 409)
    }
    const name = (req.user as { name?: string }).name ?? req.user.email ?? 'Someone'
    await req.payload.kv.set(LOCK_KEY, { userId: me, name, at: new Date().toISOString() })
    if (lock && lock.userId !== me) {
      await audit(req, {
        action: 'settings',
        summary: `Took over editing the site design from ${lock.name}`,
      })
    }
    return json({ ok: true })
  },
}

const imageOf = (media: unknown) => {
  const m = media && typeof media === 'object' ? (media as Media) : null
  if (!m?.url) return null
  return { url: m.sizes?.card?.url ?? m.url, alt: m.alt ?? '', width: m.width, height: m.height }
}

export const toDArticle = (article: Article): DArticle => ({
  id: article.id,
  title: article.title,
  slug: article.slug ?? '',
  summary: article.summary ?? null,
  section:
    article.section && typeof article.section === 'object'
      ? { id: article.section.id, name: article.section.name, slug: article.section.slug }
      : null,
  authors: article.guestByline?.trim()
    ? [article.guestByline.trim()]
    : (article.authors ?? []).flatMap((a) => (typeof a === 'object' && a ? [a.name] : [])),
  image: imageOf(article.heroImage),
})

const when = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Toronto',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

/**
 * GET /api/globals/site-design/preview-data
 * Real stories (published, and those waiting for the next issue), sections and
 * live figures, so the designer shows the page as readers will see it.
 */
export const designPreviewEndpoint: Endpoint = {
  path: '/preview-data',
  method: 'get',
  handler: async (req) => {
    if (rankOf(req.user) < RANK.reporter) return json({ message: 'Sign in first.' }, 401)
    const { payload } = req
    const select = {
      title: true,
      slug: true,
      summary: true,
      section: true,
      authors: true,
      heroImage: true,
      guestByline: true,
      publishedAt: true,
    } as const
    const [published, waiting, sections, issues, board, mostRead, settings, pages, tags, staff] =
      await Promise.all([
      payload.find({
        collection: 'articles',
        where: { _status: { equals: 'published' } },
        sort: '-publishedAt',
        limit: 80,
        depth: 1,
        overrideAccess: true,
        select,
      }),
      payload.find({
        collection: 'articles',
        draft: true,
        where: { workflow: { equals: 'approved' } },
        sort: '-updatedAt',
        limit: 40,
        depth: 1,
        overrideAccess: true,
        select,
      }),
      payload.find({
        collection: 'sections',
        sort: 'order',
        limit: 100,
        overrideAccess: true,
        depth: 0,
      }),
      payload.find({
        collection: 'issues',
        where: { _status: { equals: 'published' } },
        sort: '-date',
        limit: 1,
        depth: 0,
        overrideAccess: true,
      }),
      buildBoard(payload).catch(() => null),
      mostReadStories(payload).catch(() => []),
      payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true }),
      payload.find({
        collection: 'pages',
        draft: true,
        sort: 'title',
        limit: 200,
        depth: 0,
        overrideAccess: true,
        select: { title: true, slug: true, showInNav: true, showInFooter: true, _status: true },
      }),
      payload.count({ collection: 'tags', where: { _status: { equals: 'published' } } }),
      payload.count({
        collection: 'users',
        where: { role: { in: ['reporter', 'editor', 'exec'] } },
      }),
    ])
    const articles = published.docs.map((a) => toDArticle(a as Article))
    const byId: Record<number, DArticle> = {}
    for (const a of [...articles, ...waiting.docs.map((w) => toDArticle(w as Article))])
      byId[a.id] = a
    const issue = issues.docs[0]
    const data: DesignData = {
      site: siteInfo({
        name: settings.siteName || 'BOSS Today',
        tagline: settings.tagline || 'The student newspaper of Bur Oak Secondary School.',
        footerNote: settings.footerNote ?? '',
        sections: sections.docs.map(({ name, slug }) => ({ name, slug: slug ?? '' })),
        pages: pages.docs.map((p) => ({ ...p, slug: p.slug ?? '' })),
        socialLinks: (settings.socialLinks ?? []).map(({ label, url }) => ({ label, url })),
        hasTags: tags.totalDocs > 0,
        hasStaff: staff.totalDocs > 0,
        hasContact: true,
        hasAbout: Boolean(settings.about),
        cmsUrl: '',
      }),
      articles,
      byId,
      media: {},
      issue: issue
        ? {
            title: issue.title,
            label: `Vol. ${issue.volume}, No. ${issue.number}`,
            href: `/issues/${issue.volume}-${issue.number}/`,
          }
        : null,
      preview: {
        mostRead: mostRead.map(({ title, url, section }) => ({ title, url, section })),
        scores: (board?.games ?? [])
          .filter((g) => g.status === 'final' || g.status === 'live')
          .map(
            (g) =>
              `${g.team}: ${g.ourScore ?? 0}–${g.theirScore ?? 0} ${g.home ? 'vs' : 'at'} ${g.opponent}`,
          ),
        events: (board?.events ?? []).map(
          (e) => `${when.format(new Date(e.startsAt))} · ${e.title}`,
        ),
        live: (board?.live ?? []).filter((l) => l.status === 'live').map((l) => l.title),
      },
    }
    return json({
      data,
      sections: sections.docs.map(({ id, name }) => ({ id, name })),
      waiting: waiting.docs.map(({ id, title }) => ({ id, title })),
      pages: pages.docs.map(({ id, title, slug }) => ({ id, title, slug })),
    })
  },
}

/** POST /api/globals/site-design/publish-now  { reason } — the saved designs and pages, on their own. */
export const publishDesignNowEndpoint: Endpoint = {
  path: '/publish-now',
  method: 'post',
  handler: async (req) => {
    if (!canPublishIssues(req.user)) return json({ message: 'You need the Issue permission.' }, 403)
    const body = (req.json ? await req.json().catch(() => ({})) : {}) as { reason?: string }
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : ''
    if (!reason) return json({ message: 'Say why this can’t wait for the next issue.' }, 400)
    try {
      const [draft, pages] = await Promise.all([
        req.payload.findGlobal({
          slug: 'site-design',
          draft: true,
          depth: 0,
          overrideAccess: true,
          req,
        }),
        req.payload.find({
          collection: 'pages',
          draft: true,
          where: { _status: { equals: 'draft' } },
          limit: 100,
          depth: 0,
          overrideAccess: true,
          req,
          select: { title: true },
        }),
      ])
      if (draft._status !== 'draft' && pages.docs.length === 0) {
        return json({ message: 'The website already shows the latest saved design.' }, 409)
      }
      await assertDeployBudget(req.payload, 'issue', req)
      const context = { issuePublish: true }
      if (draft._status === 'draft') {
        await req.payload.updateGlobal({
          slug: 'site-design',
          data: { _status: 'published' },
          req,
          overrideAccess: true,
          context,
        })
      }
      for (const page of pages.docs) {
        await req.payload.update({
          collection: 'pages',
          id: page.id,
          data: { _status: 'published' },
          req,
          overrideAccess: true,
          context,
        })
      }
      await audit(req, {
        action: 'publish',
        summary: `Published the site design straight away: ${reason}`,
        target: 'global:site-design',
      })
      const deploy = await triggerDeploy(req, { reason: 'design', note: reason })
      return json({ ok: true, deploy })
    } catch (error) {
      return json(
        { message: error instanceof Error ? error.message : 'Something went wrong.' },
        error instanceof APIError ? error.status : 400,
      )
    }
  },
}
