import {
  APIError,
  type CollectionAfterChangeHook,
  type CollectionAfterDeleteHook,
  type Payload,
  type PayloadRequest,
} from 'payload'

import { audit } from '../hooks/audit'
import { publicizeMedia, syncPublicImages } from '../storage/publicImages'
import { liveStoreConfigured, putLive } from './liveStore'
import { exportLiveBlogs } from './siteContent'

/**
 * Scores, the calendar and live coverage change between issues, so they live
 * in Cloudflare KV like the banner. Every save rewrites the "board" (what the
 * front page shows) and, for live coverage, that coverage's own page. Readers
 * see the change within a minute; nothing is rebuilt.
 */
const DAY = 24 * 60 * 60 * 1000

/** Games from three weeks ago to two months ahead; the browser picks what to show. */
export const buildBoard = async (payload: Payload, req?: PayloadRequest) => {
  const now = Date.now()
  const [games, events, live] = await Promise.all([
    payload.find({
      collection: 'games',
      where: {
        and: [
          { startsAt: { greater_than_equal: new Date(now - 21 * DAY).toISOString() } },
          { startsAt: { less_than_equal: new Date(now + 60 * DAY).toISOString() } },
        ],
      },
      sort: 'startsAt',
      limit: 300,
      depth: 1,
      overrideAccess: true,
      req,
    }),
    payload.find({
      collection: 'events',
      where: {
        and: [
          {
            or: [
              { endsAt: { greater_than_equal: new Date(now - DAY).toISOString() } },
              { startsAt: { greater_than_equal: new Date(now - DAY).toISOString() } },
            ],
          },
          { startsAt: { less_than_equal: new Date(now + 120 * DAY).toISOString() } },
        ],
      },
      sort: 'startsAt',
      limit: 300,
      depth: 0,
      overrideAccess: true,
      req,
    }),
    payload.find({
      collection: 'live-blogs',
      sort: '-updatedAt',
      limit: 20,
      depth: 0,
      overrideAccess: true,
      req,
      select: { title: true, slug: true, status: true, updatedAt: true },
    }),
  ])
  return {
    updatedAt: new Date().toISOString(),
    games: games.docs.map((game) => ({
      id: game.id,
      team: game.team,
      opponent: game.opponent,
      startsAt: game.startsAt,
      location: game.location ?? null,
      home: game.home !== 'away',
      status: game.status,
      ourScore: game.ourScore ?? null,
      theirScore: game.theirScore ?? null,
      note: game.note ?? null,
      // Only link a recap readers can see.
      recap:
        game.recap && typeof game.recap === 'object' && game.recap._status === 'published'
          ? `/article/${game.recap.slug}/`
          : null,
    })),
    events: events.docs.map((event) => ({
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt ?? null,
      allDay: Boolean(event.allDay),
      location: event.location ?? null,
      description: event.description ?? null,
      link: event.link ?? null,
    })),
    live: live.docs.map(({ slug, title, status, updatedAt }) => ({
      slug,
      title,
      status,
      updatedAt,
    })),
  }
}

/** Rewrites the board, and one coverage's page if given. Throws if Cloudflare refuses. */
export const refreshBoard = async (payload: Payload, req?: PayloadRequest, blogSlug?: string) => {
  if (!liveStoreConfigured()) return
  if (blogSlug) {
    const blog = (await exportLiveBlogs(payload, req)).find((item) => item.slug === blogSlug)
    // Photos must be in the public image repository before readers are pointed at them.
    if (blog?.updates.some((update) => update.image)) await syncPublicImages(payload, req)
    await putLive(`live:${blogSlug}`, blog ? publicizeMedia(blog) : {})
  }
  await putLive('board', await buildBoard(payload, req))
}

const failed = (error: unknown) =>
  new APIError(
    `Saved, but the website couldn’t be updated: ${error instanceof Error ? error.message : String(error)}`,
    502,
    undefined,
    true,
  )

export const refreshBoardAfterChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  collection,
  req,
}) => {
  try {
    const isBlog = collection.slug === 'live-blogs'
    await refreshBoard(req.payload, req, isBlog ? doc.slug : undefined)
    // A renamed coverage leaves nothing behind at its old address.
    if (isBlog && previousDoc?.slug && previousDoc.slug !== doc.slug) {
      await putLive(`live:${previousDoc.slug}`, {})
    }
  } catch (error) {
    throw failed(error)
  }
  return doc
}

export const refreshBoardAfterDelete: CollectionAfterDeleteHook = async ({
  doc,
  collection,
  req,
}) => {
  try {
    if (!liveStoreConfigured()) return doc
    if (collection.slug === 'live-blogs' && doc.slug) await putLive(`live:${doc.slug}`, {})
    await putLive('board', await buildBoard(req.payload, req))
  } catch (error) {
    throw failed(error)
  }
  return doc
}

/** Live changes skip the issue sign-off, so each one is in the audit log. */
export const auditLiveChange =
  (noun: string): CollectionAfterChangeHook =>
  async ({ doc, previousDoc, operation, req }) => {
    const title = String(doc.title ?? `#${doc.id}`)
    let summary = `${operation === 'create' ? 'Added' : 'Updated'} ${noun} “${title}”`
    if (doc.ourScore !== undefined || doc.status !== undefined) {
      if (doc.ourScore !== null && doc.ourScore !== undefined) {
        summary += `: ${doc.ourScore}–${doc.theirScore ?? 0} (${doc.status})`
      } else if (doc.status) summary += ` (${doc.status})`
    }
    const before = (previousDoc?.updates ?? []).length
    const after = (doc.updates ?? []).length
    if (Array.isArray(doc.updates) && after !== before) {
      summary +=
        after > before
          ? `, posted ${after - before} update(s)`
          : `, removed ${before - after} update(s)`
    }
    await audit(req, { action: 'live', summary, target: `${noun}:${doc.id}` })
    return doc
  }
