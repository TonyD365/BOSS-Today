import config from '@payload-config'
import { getPayload, type Where } from 'payload'

import type { Article, Issue, Section } from '@/payload-types'

const published: Where = { _status: { equals: 'published' } }

const client = () => getPayload({ config })

export const getSettings = async () => {
  const payload = await client()
  const settings = await payload.findGlobal({ slug: 'settings', depth: 0 })
  return {
    ...settings,
    siteName: settings.siteName || 'BOSS Today',
    tagline: settings.tagline || 'The student newspaper of Bur Oak Secondary School.',
  }
}

export type SiteSettings = Awaited<ReturnType<typeof getSettings>>

export const getSections = async (): Promise<Section[]> => {
  const payload = await client()
  const { docs } = await payload.find({
    collection: 'sections',
    where: published,
    sort: 'order',
    limit: 20,
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

export type IssueStory = {
  article: Article
  width: 'full' | 'twoThirds' | 'half' | 'column'
  showImage: boolean
}

/** The stories of an issue, in order. Readers never see unpublished ones. */
export const issueStories = (issue: Issue, includeDrafts = false): IssueStory[] =>
  (issue.stories ?? []).flatMap((story) => {
    const article = story.article
    if (typeof article !== 'object' || !article) return []
    if (!includeDrafts && article._status !== 'published') return []
    return [{ article, width: story.width ?? 'full', showImage: story.showImage !== false }]
  })

export const issueArticles = (issue: Issue, includeDrafts = false): Article[] =>
  issueStories(issue, includeDrafts).map((story) => story.article)

/** Active staff with a title, for the print edition's staff box. */
export const getStaffBox = async () => {
  const payload = await client()
  const { docs } = await payload.find({
    collection: 'users',
    where: {
      and: [
        { active: { not_equals: false } },
        { role: { not_equals: 'reader' } },
        { title: { exists: true } },
      ],
    },
    sort: 'name',
    limit: 200,
    depth: 0,
    select: { name: true, title: true },
  })
  return docs
    .filter((person) => person.title)
    .map((person) => ({ name: person.name, title: person.title as string }))
}
