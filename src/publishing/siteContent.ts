import type { Payload, PayloadRequest, Where } from 'payload'

import { cleanDesign, cleanTemplates } from '../design/sanitize'
import { REMOVED_KEY } from '../hooks/audit'
import { cleanLook } from '../lib/look'
import { positionTitle } from '../lib/positions'
import type { Design } from '../design/types'
import type { Article, Media, User } from '../payload-types'

/**
 * Everything the public site shows, and nothing else. The Cloudflare build
 * reads it through /api/site-export; the image sync uses it to decide which
 * images belong in the public repository.
 */
export const EXPORT_PAGE_SIZE = 40

/** Only what a reader may see of a staff member. */
const publicAuthor = (user: User | number | null | undefined) =>
  user && typeof user === 'object'
    ? {
        id: user.id,
        name: user.name,
        title: user.title || positionTitle(user.positions ?? []) || null,
        bio: user.bio ?? null,
        slug: user.slug ?? null,
        photo: user.photo && typeof user.photo === 'object' ? (user.photo as Media) : null,
      }
    : null

const published: Where = { _status: { equals: 'published' } }

const idOf = (value: unknown) =>
  value && typeof value === 'object' ? (value as { id: number }).id : (value as number)

/** One page of published stories, newest first. */
export const exportArticles = async (payload: Payload, page: number) => {
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
  return { page, totalPages: result.totalPages, docs }
}

const designed = (value: unknown): Design | null => {
  if (!value) return null
  const design = cleanDesign(value)
  return design.desktop.elements.length > 0 ? design : null
}

/**
 * The published designs: front page, header, footer and custom pages, with
 * the images they place. Anything not designed (or not yet published) is null
 * and keeps its classic look.
 */
export const exportDesign = async (payload: Payload) => {
  const [global, pages] = await Promise.all([
    payload.findGlobal({ slug: 'site-design', depth: 0, overrideAccess: true }),
    payload.find({
      collection: 'pages',
      where: published,
      sort: 'title',
      limit: 200,
      depth: 0,
      overrideAccess: true,
    }),
  ])
  const live = global._status === 'published'
  const front = live ? designed(global.design) : null
  const header = live ? designed(global.header) : null
  const footer = live ? designed(global.footer) : null
  const templates = live ? cleanTemplates(global.templates) : {}
  const customPages = pages.docs.flatMap((page) => {
    const design = designed(page.design)
    return design
      ? [
          {
            id: page.id,
            title: page.title,
            slug: page.slug,
            description: page.description ?? '',
            showInNav: Boolean(page.showInNav),
            showInFooter: Boolean(page.showInFooter),
            design,
          },
        ]
      : []
  })
  const mediaIds = [
    ...new Set(
      [
        front,
        header,
        footer,
        ...customPages.map((p) => p.design),
        ...Object.values(templates).flatMap((t) => [t.above, t.side, t.below]),
      ].flatMap((design) =>
        (design?.desktop.elements ?? []).flatMap((el) =>
          el.type === 'image' && el.props.mediaId ? [el.props.mediaId] : [],
        ),
      ),
    ),
  ]
  const media = mediaIds.length
    ? (
        await payload.find({
          collection: 'media',
          where: { id: { in: mediaIds } },
          limit: mediaIds.length,
          depth: 0,
          overrideAccess: true,
        })
      ).docs
    : []
  return { design: front, header, footer, templates, pages: customPages, media }
}

/** Site settings, sections, tags, issues and staff. */
export const exportMeta = async (payload: Payload, cmsUrl: string) => {
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

  // Stories that were on the website and aren't now (withdrawn, taken down or deleted).
  const [withdrawn, deleted, live] = await Promise.all([
    payload.find({
      collection: 'articles',
      draft: true,
      where: { workflow: { equals: 'withdrawn' } },
      limit: 0,
      pagination: false,
      depth: 0,
      overrideAccess: true,
      select: { slug: true },
    }),
    payload.kv.get<string[]>(REMOVED_KEY),
    payload.find({
      collection: 'articles',
      where: published,
      limit: 0,
      pagination: false,
      depth: 0,
      overrideAccess: true,
      select: { slug: true },
    }),
  ])
  const liveSlugs = new Set(live.docs.map((d) => d.slug))
  const removedStories = [
    ...new Set([...withdrawn.docs.map((d) => d.slug ?? ''), ...(deleted ?? [])]),
  ].filter((slug) => slug && !liveSlugs.has(slug))

  return {
    removedStories,
    generatedAt: new Date().toISOString(),
    design: await exportDesign(payload),
    cmsUrl,
    settings: {
      siteName: settings.siteName || 'BOSS Today',
      tagline: settings.tagline || 'The student newspaper of Bur Oak Secondary School.',
      about: settings.about ?? null,
      standards: settings.standards ?? null,
      look: cleanLook(settings.look),
      socialLinks: (settings.socialLinks ?? []).map(({ label, url }) => ({ label, url })),
      footerNote: settings.footerNote ?? '',
      joinUs: settings.joinUs ?? null,
      googleVerification: settings.googleVerification ?? null,
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
    staff: staff.docs.map((user) => ({
      ...publicAuthor(user)!,
      role: user.role,
      positions: user.positions ?? [],
    })),
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
            showQrCodes: issue.showQrCodes !== false,
            announcement: issue.announcement ?? null,
            stories: (issue.stories ?? []).map((story) => ({
              id: typeof story.article === 'object' ? story.article?.id : story.article,
              width: story.width ?? 'full',
              showImage: story.showImage !== false,
            })),
          }
        : null,
    })),
  }
}

/** Every published story, all pages. */
export const exportAllArticles = async (payload: Payload) => {
  const docs: Awaited<ReturnType<typeof exportArticles>>['docs'] = []
  for (let page = 1; ; page++) {
    const batch = await exportArticles(payload, page)
    docs.push(...batch.docs)
    if (page >= batch.totalPages) break
  }
  return docs
}

/** Live coverage is public from the moment it is posted, including its photos. */
export const exportLiveBlogs = async (payload: Payload, req?: PayloadRequest) =>
  (
    await payload.find({
      collection: 'live-blogs',
      sort: '-updatedAt',
      limit: 50,
      depth: 1,
      overrideAccess: true,
      // Inside a save, read through its transaction to see the change being saved.
      req,
    })
  ).docs.map((blog) => ({
    slug: blog.slug,
    title: blog.title,
    summary: blog.summary ?? null,
    status: blog.status,
    updatedAt: blog.updatedAt,
    updates: [...(blog.updates ?? [])]
      .sort((a, b) => new Date(b.at ?? 0).getTime() - new Date(a.at ?? 0).getTime())
      .map((update) => ({
        id: update.id,
        at: update.at ?? null,
        text: update.text,
        image: update.image && typeof update.image === 'object' ? update.image : null,
      })),
  }))
