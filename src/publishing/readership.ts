import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { eq, sql } from '@payloadcms/db-postgres/drizzle'
import type { Payload } from 'payload'

import { liveStoreConfigured, putLive } from './liveStore'

/**
 * Readership from Cloudflare Web Analytics (free, no cookies). Each day's page
 * views are copied into our own database, because Cloudflare keeps them for
 * only about six months, and the week's most-read stories are written to KV
 * for the front page.
 */
const DAYS_KEPT_FRESH = 30
const MAX_PATHS_PER_DAY = 400
const MAX_REFERRERS_PER_DAY = 25
const SYNC_EVERY_MS = 60 * 60 * 1000
export const MOST_READ_SIZE = 10

const LAST_SYNC = 'readership:lastSync'
const DONE_DAYS = 'readership:completeDays'
const LAST_ERROR = 'readership:lastError'

const analytics = () => {
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim()
  const account = process.env.CLOUDFLARE_ACCOUNT_ID?.trim()
  const siteTag = process.env.CLOUDFLARE_ANALYTICS_SITE_TAG?.trim()
  if (!token || !account || !siteTag) return null
  const base = (
    process.env.CLOUDFLARE_API_BASE?.trim() || 'https://api.cloudflare.com/client/v4'
  ).replace(/\/$/, '')
  return { url: `${base}/graphql`, token, account, siteTag }
}

export const readershipConfigured = () => analytics() !== null

/** "2026-10-14" for a date, in UTC like Cloudflare's own day boundaries. */
const dayOf = (date: Date) => date.toISOString().slice(0, 10)
const daysAgo = (n: number, from = new Date()) => {
  const date = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  date.setUTCDate(date.getUTCDate() - n)
  return date
}

/** "/article/some-story/" and "/Article/some-story" are the same page. */
export const normalizePath = (path: string) => {
  const clean = path.split(/[?#]/)[0].toLowerCase().replace(/\/+$/, '')
  return clean || '/'
}

export const articleSlugFromPath = (path: string) =>
  /^\/article\/([^/]+)$/.exec(normalizePath(path))?.[1] ?? null

const QUERY = `
query Readership($accountTag: string!, $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject!, $paths: uint64!, $referrers: uint64!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      paths: rumPageloadEventsAdaptiveGroups(filter: $filter, limit: $paths, orderBy: [count_DESC]) {
        count
        sum { visits }
        dimensions { requestPath }
      }
      referrers: rumPageloadEventsAdaptiveGroups(filter: $filter, limit: $referrers, orderBy: [count_DESC]) {
        count
        dimensions { refererHost }
      }
    }
  }
}`

type Row = { day: string; kind: 'path' | 'referrer'; key: string; views: number; visits: number }

type Group = {
  count: number
  sum?: { visits?: number }
  dimensions: { requestPath?: string; refererHost?: string }
}

const fetchDay = async (day: Date): Promise<Row[]> => {
  const api = analytics()!
  const end = new Date(day)
  end.setUTCDate(end.getUTCDate() + 1)
  const response = await fetch(api.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${api.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: QUERY,
      variables: {
        accountTag: api.account,
        filter: {
          siteTag: api.siteTag,
          datetime_geq: day.toISOString(),
          datetime_lt: end.toISOString(),
        },
        paths: MAX_PATHS_PER_DAY,
        referrers: MAX_REFERRERS_PER_DAY,
      },
    }),
  })
  const body = (await response.json().catch(() => null)) as {
    data?: { viewer?: { accounts?: { paths?: Group[]; referrers?: Group[] }[] } }
    errors?: { message?: string }[] | null
  } | null
  if (!response.ok || body?.errors?.length) {
    throw new Error(
      `Cloudflare analytics said ${response.status}${body?.errors?.[0]?.message ? `: ${body.errors[0].message}` : ''}`,
    )
  }
  const account = body?.data?.viewer?.accounts?.[0]
  const key = dayOf(day)
  const merged = new Map<string, Row>()
  for (const group of account?.paths ?? []) {
    const path = normalizePath(group.dimensions.requestPath ?? '/')
    const row = merged.get(`path:${path}`) ?? {
      day: key,
      kind: 'path',
      key: path,
      views: 0,
      visits: 0,
    }
    row.views += group.count ?? 0
    row.visits += group.sum?.visits ?? 0
    merged.set(`path:${path}`, row)
  }
  for (const group of account?.referrers ?? []) {
    const host = (group.dimensions.refererHost ?? '').toLowerCase() || '(direct)'
    const row = merged.get(`referrer:${host}`) ?? {
      day: key,
      kind: 'referrer',
      key: host,
      views: 0,
      visits: 0,
    }
    row.views += group.count ?? 0
    merged.set(`referrer:${host}`, row)
  }
  return [...merged.values()]
}

const database = (payload: Payload) => payload.db as unknown as PostgresAdapter

/** Replaces one day's rows: a statement to clear it and one to insert them all. */
const saveDay = async (payload: Payload, day: string, rows: Row[]) => {
  const { drizzle, tables } = database(payload)
  const pageViews = tables.page_views
  await drizzle.delete(pageViews).where(eq(pageViews.day, day))
  if (rows.length > 0) await drizzle.insert(pageViews).values(rows)
}

/**
 * Brings stored page views up to date: today and yesterday every time, and any
 * of the last 30 days not yet complete. Then refreshes Most read. Runs at most
 * hourly unless forced; errors are kept for the dashboard to show.
 */
export const syncReadership = async (payload: Payload, { force = false } = {}) => {
  if (!readershipConfigured()) return { configured: false as const }
  const last = await payload.kv.get<string>(LAST_SYNC)
  if (!force && last && Date.now() - new Date(last).getTime() < SYNC_EVERY_MS) {
    return { configured: true as const, skipped: true }
  }
  await payload.kv.set(LAST_SYNC, new Date().toISOString())

  try {
    const done = new Set((await payload.kv.get<string[]>(DONE_DAYS)) ?? [])
    const days: Date[] = []
    for (let n = DAYS_KEPT_FRESH; n >= 0; n--) {
      const day = daysAgo(n)
      if (n <= 1 || !done.has(dayOf(day))) days.push(day)
    }
    for (const day of days) {
      await saveDay(payload, dayOf(day), await fetchDay(day))
      // Yesterday and earlier won't change any more.
      if (day < daysAgo(1)) done.add(dayOf(day))
    }
    const keep = dayOf(daysAgo(DAYS_KEPT_FRESH + 5))
    await payload.kv.set(
      DONE_DAYS,
      [...done].filter((day) => day >= keep),
    )
    await payload.kv.delete(LAST_ERROR)

    const mostRead = await mostReadStories(payload)
    if (liveStoreConfigured()) await putLive('mostread', mostRead)
    return { configured: true as const, days: days.length, mostRead: mostRead.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await payload.kv.set(LAST_ERROR, { message, at: new Date().toISOString() })
    payload.logger.error({ err: error, msg: 'Readership sync failed' })
    return { configured: true as const, error: message }
  }
}

type StoredRow = { day: string; kind: string; key: string; views: number; visits?: number | null }

const rowsSince = async (payload: Payload, day: string) =>
  (
    await payload.find({
      collection: 'page-views',
      where: { day: { greater_than_equal: day } },
      limit: 0,
      pagination: false,
      depth: 0,
      overrideAccess: true,
      select: { day: true, kind: true, key: true, views: true, visits: true },
    })
  ).docs as unknown as StoredRow[]

const publishedBySlug = async (payload: Payload, slugs: string[]) => {
  if (slugs.length === 0) return new Map()
  const { docs } = await payload.find({
    collection: 'articles',
    where: { and: [{ slug: { in: slugs } }, { _status: { equals: 'published' } }] },
    limit: slugs.length,
    depth: 1,
    overrideAccess: true,
    select: { title: true, slug: true, section: true },
  })
  return new Map(docs.map((doc) => [doc.slug!, doc]))
}

const sumByArticle = (rows: StoredRow[]) => {
  const totals = new Map<string, number>()
  for (const row of rows) {
    if (row.kind !== 'path') continue
    const slug = articleSlugFromPath(row.key)
    if (slug) totals.set(slug, (totals.get(slug) ?? 0) + row.views)
  }
  return totals
}

/** The week's most-read published stories, as the front page shows them. */
export const mostReadStories = async (payload: Payload) => {
  const rows = await rowsSince(payload, dayOf(daysAgo(6)))
  const ranked = [...sumByArticle(rows).entries()].sort((a, b) => b[1] - a[1])
  const stories = await publishedBySlug(
    payload,
    ranked.slice(0, MOST_READ_SIZE * 2).map(([slug]) => slug),
  )
  return ranked
    .filter(([slug]) => stories.has(slug))
    .slice(0, MOST_READ_SIZE)
    .map(([slug, views]) => {
      const story = stories.get(slug)
      return {
        title: story.title as string,
        url: `/article/${slug}/`,
        section: typeof story.section === 'object' ? (story.section?.name ?? null) : null,
        views,
      }
    })
}

/** Everything the dashboard's Readership card shows. */
export const readershipSummary = async (payload: Payload) => {
  const lastSync = await payload.kv.get<string>(LAST_SYNC)
  const lastError = await payload.kv.get<{ message: string; at: string }>(LAST_ERROR)
  const weekStart = dayOf(daysAgo(6))
  const rows = await rowsSince(payload, dayOf(daysAgo(29)))
  const pages = rows.filter((row) => row.kind === 'path')
  const total = (list: StoredRow[]) =>
    list.reduce(
      (sum, row) => ({ views: sum.views + row.views, visits: sum.visits + (row.visits ?? 0) }),
      { views: 0, visits: 0 },
    )

  const month = sumByArticle(pages)
  const stories = await publishedBySlug(payload, [...month.keys()])
  const week = sumByArticle(pages.filter((row) => row.day >= weekStart))
  const topWeek = [...week.entries()]
    .filter(([slug]) => stories.has(slug))
    .sort((a, b) => b[1] - a[1])
    .slice(0, MOST_READ_SIZE)
    .map(([slug, views]) => ({
      id: stories.get(slug).id as number,
      title: stories.get(slug).title as string,
      views,
    }))

  const sections = new Map<string, number>()
  for (const [slug, views] of month) {
    const story = stories.get(slug)
    if (!story) continue
    const name =
      typeof story.section === 'object' ? (story.section?.name ?? 'No section') : 'No section'
    sections.set(name, (sections.get(name) ?? 0) + views)
  }

  const referrers = new Map<string, number>()
  for (const row of rows) {
    if (row.kind === 'referrer') referrers.set(row.key, (referrers.get(row.key) ?? 0) + row.views)
  }

  return {
    configured: readershipConfigured(),
    lastSync,
    lastError,
    week: total(pages.filter((row) => row.day >= weekStart)),
    month: total(pages),
    topWeek,
    sections: [...sections.entries()].sort((a, b) => b[1] - a[1]),
    referrers: [...referrers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
  }
}

/** All-time views of one story, from every day stored. */
export const storyViews = async (payload: Payload, slug: string) => {
  const result = (await database(payload).drizzle.execute(
    sql`SELECT COALESCE(SUM("views"), 0)::int AS views FROM "page_views" WHERE "kind" = 'path' AND "key" = ${`/article/${slug.toLowerCase()}`}`,
  )) as { rows?: { views: number }[] }
  return result.rows?.[0]?.views ?? 0
}
