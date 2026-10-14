import config from '@payload-config'
import { getPayload, type Where } from 'payload'

import type { Article, Issue, Media, Section, User } from '@/payload-types'

const published: Where = { _status: { equals: 'published' } }

const client = () => getPayload({ config })

export const getSections = async (): Promise<Section[]> => {
  const payload = await client()
  const { docs } = await payload.find({ collection: 'sections', sort: 'order', limit: 20 })
  return docs
}

const findArticles = async (where: Where, limit: number, page = 1) => {
  const payload = await client()
  return payload.find({
    collection: 'articles',
    where: { and: [published, where] },
    sort: '-publishedAt',
    depth: 1,
    limit,
    page,
    select: { content: false },
  })
}

const isPublishedArticle = (value: unknown): value is Article =>
  typeof value === 'object' && value !== null && (value as Article)._status === 'published'

export const getFrontPage = async () => {
  const payload = await client()
  const sections = await getSections()
  const [frontPage, latestResult, ...sectionResults] = await Promise.all([
    payload.findGlobal({ slug: 'front-page', depth: 2 }),
    findArticles({}, 16),
    ...sections.map((section) => findArticles({ section: { equals: section.id } }, 4)),
  ])
  const latestDocs = latestResult.docs as Article[]

  const used = new Set<number>()
  const take = (docs: Article[], count: number) => {
    const picked = docs.filter((doc) => !used.has(doc.id)).slice(0, count)
    picked.forEach((doc) => used.add(doc.id))
    return picked
  }

  // Editors' picks first; empty slots fall back to the newest stories.
  const chosenLead = isPublishedArticle(frontPage.lead) ? frontPage.lead : undefined
  const lead = take(chosenLead ? [chosenLead] : latestDocs, 1)[0]
  const chosenFeatured = (frontPage.featured ?? []).filter(isPublishedArticle)
  let featured = take(chosenFeatured, 6)
  if (featured.length < 3) featured = [...featured, ...take(latestDocs, 3 - featured.length)]
  const latest = take(latestDocs, 6)

  return {
    lead,
    featured: featured.slice(0, 3),
    latest: [...featured.slice(3), ...latest].slice(0, 6),
    bySection: sections
      .map((section, index) => ({ section, articles: sectionResults[index].docs as Article[] }))
      .filter((block) => block.articles.length > 0),
  }
}

export const getArticle = async (slug: string): Promise<Article | undefined> => {
  const payload = await client()
  const { docs } = await payload.find({
    collection: 'articles',
    where: { and: [published, { slug: { equals: slug } }] },
    depth: 2,
    limit: 1,
  })
  return docs[0]
}

export const getSection = async (slug: string, page = 1) => {
  const payload = await client()
  const { docs } = await payload.find({
    collection: 'sections',
    where: { slug: { equals: slug } },
    limit: 1,
  })
  const section = docs[0]
  if (!section) return undefined
  const articles = await findArticles({ section: { equals: section.id } }, 20, page)
  return { section, articles }
}

/** Only the public parts of a staff profile ever leave the server. */
export type Author = Pick<User, 'id' | 'name' | 'title' | 'bio' | 'slug'> & {
  photo?: Media | null
}

export const toAuthor = (user: User | number): Author | undefined => {
  if (typeof user === 'number') return undefined
  return {
    id: user.id,
    name: user.name,
    title: user.title,
    bio: user.bio,
    slug: user.slug,
    photo: user.photo && typeof user.photo === 'object' ? user.photo : null,
  }
}

export const getAuthor = async (slug: string) => {
  const payload = await client()
  const { docs } = await payload.find({
    collection: 'users',
    where: { slug: { equals: slug } },
    depth: 1,
    limit: 1,
  })
  const author = docs[0] ? toAuthor(docs[0]) : undefined
  if (!author) return undefined
  const articles = await findArticles({ authors: { in: [author.id] } }, 30)
  return { author, articles: articles.docs as Article[] }
}

export const searchArticles = async (query: string) => {
  const term = query.trim().slice(0, 100)
  if (!term) return []
  const result = await findArticles(
    { or: [{ title: { like: term } }, { summary: { like: term } }] },
    30,
  )
  return result.docs as Article[]
}

export const getIssues = async (): Promise<Issue[]> => {
  const payload = await client()
  const { docs } = await payload.find({
    collection: 'issues',
    where: published,
    sort: '-date',
    depth: 0,
    limit: 100,
  })
  return docs
}

export const parseEdition = (edition: string) => {
  const match = /^(\d+)-(\d+)$/.exec(edition)
  return match ? { volume: Number(match[1]), number: Number(match[2]) } : undefined
}

export const getIssue = async (
  edition: string,
  options: { includeDrafts?: boolean } = {},
): Promise<Issue | undefined> => {
  const parsed = parseEdition(edition)
  if (!parsed) return undefined
  const payload = await client()
  const where: Where = {
    and: [{ volume: { equals: parsed.volume } }, { number: { equals: parsed.number } }],
  }
  const { docs } = await payload.find({
    collection: 'issues',
    where: options.includeDrafts ? where : { and: [published, where] },
    draft: options.includeDrafts,
    depth: 2,
    limit: 1,
  })
  return docs[0]
}

/** The stories of an issue, in order. Readers never see unpublished ones. */
export const issueArticles = (issue: Issue, includeDrafts = false): Article[] =>
  (issue.articles ?? []).filter(
    (article): article is Article =>
      typeof article === 'object' && (includeDrafts || article._status === 'published'),
  )
