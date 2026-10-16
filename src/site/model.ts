import type { PaperSize } from '@/components/print/PrintEdition'
import type { Design } from '@/design/types'
import type { Author } from '@/lib/author'
import type { DArticle, DesignData } from '@/design/render'
import type { Article, Media } from '@/payload-types'

/** Shapes returned by /api/site-export (see src/endpoints/siteExport.ts). */
export type ExportSection = {
  id: number
  name: string
  slug: string
  description: string | null
  order: number
}

export type ExportStaff = Author & { photo: Media | null; role: 'reporter' | 'editor' | 'exec' }

export type ExportTag = {
  id: number
  name: string
  slug: string
  description: string | null
  image: Media | null
}

export type ExportIssue = {
  id: number
  title: string
  volume: number
  number: number
  date: string
  printEdition: boolean
  stories: number[]
  print: {
    paperSize: PaperSize
    showContents: boolean
    showStaffBox: boolean
    announcement: string | null
    stories: { id: number; width: 'full' | 'twoThirds' | 'half' | 'column'; showImage: boolean }[]
  } | null
}

export type ExportMeta = {
  generatedAt: string
  design: { design: Design; media: Media[] } | null
  cmsUrl: string
  settings: {
    siteName: string
    tagline: string
    about: unknown
    socialLinks: { label: string; url: string }[]
    footerNote: string
    joinUs: unknown
  }
  frontPage: { lead: number | null; featured: number[] }
  tags: ExportTag[]
  staff: ExportStaff[]
  sections: ExportSection[]
  issues: ExportIssue[]
}

export type ExportArticle = {
  id: number
  title: string
  slug: string
  summary: string
  content: unknown
  publishedAt: string | null
  updatedAt: string
  heroImage: Media | null
  section: { id: number; name: string; slug: string } | null
  authors: (Author & { photo: Media | null })[]
  tags: { id: number; name: string; slug: string }[]
  corrections: { date: string; text: string }[]
}

/** The site components were written against Payload's Article type; exported stories fit it. */
export const asArticle = (article: ExportArticle) => article as unknown as Article

export const byNewest = (a: ExportArticle, b: ExportArticle) =>
  new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime()

/** Editors' picks first; empty slots fall back to the newest stories. */
export const frontPageLayout = (meta: ExportMeta, articles: ExportArticle[]) => {
  const byId = new Map(articles.map((article) => [article.id, article]))
  const newest = [...articles].sort(byNewest)
  const used = new Set<number>()
  const take = (list: (ExportArticle | undefined)[], count: number) => {
    const picked = list
      .filter((article): article is ExportArticle => Boolean(article) && !used.has(article!.id))
      .slice(0, count)
    picked.forEach((article) => used.add(article.id))
    return picked
  }

  const chosenLead = meta.frontPage.lead ? byId.get(meta.frontPage.lead) : undefined
  const lead = take(chosenLead ? [chosenLead] : newest, 1)[0]
  let featured = take(
    meta.frontPage.featured.map((id) => byId.get(id)),
    6,
  )
  if (featured.length < 3) featured = [...featured, ...take(newest, 3 - featured.length)]
  const latest = take(newest, 6)

  return {
    lead,
    featured: featured.slice(0, 3),
    latest: [...featured.slice(3), ...latest].slice(0, 6),
    bySection: meta.sections
      .map((section) => ({
        section,
        articles: newest.filter((article) => article.section?.id === section.id).slice(0, 4),
      }))
      .filter((block) => block.articles.length > 0),
  }
}

export const chunk = <T>(items: T[], size: number): T[][] => {
  const pages: T[][] = []
  for (let index = 0; index < items.length; index += size)
    pages.push(items.slice(index, index + size))
  return pages.length > 0 ? pages : [[]]
}

export const editionSlug = (issue: { volume: number; number: number }) =>
  `${issue.volume}-${issue.number}`

/** What the design renderer needs, from the export. Only published stories. */
export const designData = (
  meta: ExportMeta,
  articles: ExportArticle[],
  issueLink: (issue: ExportIssue) => string,
): DesignData => {
  const image = (media: Media | null | undefined) =>
    media?.url
      ? {
          url: media.sizes?.card?.url ?? media.url,
          alt: media.alt ?? '',
          width: media.width,
          height: media.height,
        }
      : null
  const list: DArticle[] = [...articles].sort(byNewest).map((article) => ({
    id: article.id,
    title: article.title,
    slug: article.slug,
    summary: article.summary,
    section: article.section,
    authors: article.authors.map((author) => author.name),
    image: image(article.heroImage),
  }))
  const latest = meta.issues[0]
  return {
    articles: list,
    byId: Object.fromEntries(list.map((a) => [a.id, a])),
    media: Object.fromEntries(
      (meta.design?.media ?? []).flatMap((m) => {
        const img = image(m)
        return img ? [[m.id, { ...img, url: m.sizes?.hero?.url ?? m.url ?? img.url }]] : []
      }),
    ),
    issue: latest
      ? {
          title: latest.title,
          label: `Vol. ${latest.volume}, No. ${latest.number}`,
          href: issueLink(latest),
        }
      : null,
  }
}
