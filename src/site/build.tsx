/**
 * Builds the public site as static files for Cloudflare Pages.
 *
 *   CMS_URL=https://<admin>.vercel.app SITE_EXPORT_TOKEN=… npm run build:site
 *
 * Content comes from the admin's /api/site-export, which only returns what has
 * been published. If anything fails the build fails, and Cloudflare keeps
 * serving the previous version of the site.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { formatDate } from '@/lib/format'

import { fontsUrl } from '@/design/fonts'
import { Designed, designFonts, DesignedHome, Templated, templateFonts } from '@/design/render'
import type { TemplateKind } from '@/design/types'
import { siteInfo } from '@/design/siteInfo'

import { rssFeed } from './feed'
import { iconImage, siteShareImage, storyShareImage } from './shareImages'
import { buildPrintEditions, printStyles } from './print'
import {
  byNewest,
  chunk,
  designData,
  editionSlug,
  type ExportArticle,
  type ExportMeta,
  frontPageLayout,
} from './model'
import {
  AboutView,
  ArticlePage,
  AuthorView,
  ContactView,
  HomeView,
  IssuesView,
  IssueView,
  LiveShell,
  NotFoundView,
  type PageMeta,
  SearchView,
  SectionView,
  Shell,
  type SiteLinks,
  StaffView,
  StandardsView,
  SubscribeView,
  TagsView,
  TagView,
} from './views'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'site-dist')
const SECTION_PAGE_SIZE = 20
/** next/font sets these in the newsroom; the static site loads the same fonts from Google. */
const FONT_VARIABLES = `:root {\n  --font-masthead: 'Manufacturing Consent';\n  --font-serif: 'Newsreader';\n  --font-sans: 'Libre Franklin';\n}`

const required = (name: string) => {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Set ${name} to build the public site.`)
  return value
}

const CMS_URL = required('CMS_URL').replace(/\/$/, '')
const TOKEN = required('SITE_EXPORT_TOKEN')
const PUBLIC_URL = (process.env.PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
/** Feeds and share links need a full address; Cloudflare provides one if PUBLIC_SITE_URL is unset. */
const SITE_URL = (PUBLIC_URL || process.env.CF_PAGES_URL || '').replace(/\/$/, '')
/** Turnstile's public key; without it the Contact page isn't built. */
const TURNSTILE_SITE_KEY = process.env.TURNSTILE_SITE_KEY?.trim() ?? ''
const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js'

const fetchExport = async <T,>(query: string): Promise<T> => {
  const response = await fetch(`${CMS_URL}/api/site-export?${query}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  if (!response.ok) {
    const body = (await response.text()).slice(0, 300).replace(/\s+/g, ' ')
    const hint =
      response.status === 401 && body.includes('Unauthorized.')
        ? 'The newsroom rejected SITE_EXPORT_TOKEN: it must match the value on Vercel exactly.'
        : response.status === 401 || response.status === 403
          ? 'Vercel blocked the request before it reached the newsroom. Use the production address (e.g. https://<project>.vercel.app) for CMS_URL, not a preview address.'
          : response.status === 404
            ? 'The newsroom does not have /api/site-export yet. Redeploy Vercel with the latest code.'
            : ''
    throw new Error(
      `Export failed (${response.status}) for ${query} from ${CMS_URL}. ${hint}\nResponse: ${body}`,
    )
  }
  return (await response.json()) as T
}

const write = async (file: string, contents: string | Buffer) => {
  const target = path.join(OUT, file)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, contents)
}

const main = async () => {
  const site = await fetchExport<ExportMeta>('part=meta')
  const articles: ExportArticle[] = []
  for (let page = 1; ; page++) {
    const batch = await fetchExport<{ docs: ExportArticle[]; totalPages: number }>(
      `part=articles&page=${page}`,
    )
    articles.push(...batch.docs)
    if (page >= batch.totalPages) break
  }
  articles.sort(byNewest)

  await fs.rm(OUT, { recursive: true, force: true })
  await fs.mkdir(OUT, { recursive: true })

  const links: SiteLinks = { staff: site.staff.length > 0, contact: Boolean(TURNSTILE_SITE_KEY) }
  const { header, footer, pages: customPages } = site.design
  const data = designData(
    site,
    articles,
    (issue) => `/issues/${editionSlug(issue)}/`,
    siteInfo({
      name: site.settings.siteName,
      tagline: site.settings.tagline,
      footerNote: site.settings.footerNote,
      sections: site.sections,
      pages: customPages,
      socialLinks: site.settings.socialLinks,
      hasTags: site.tags.length > 0,
      hasStaff: links.staff,
      hasContact: links.contact,
      hasAbout: Boolean(site.settings.about),
      cmsUrl: site.cmsUrl,
    }),
  )
  // A designed header and footer replace the classic ones on every page.
  const chrome = {
    header: header ? <Designed design={header} data={data} chrome /> : null,
    footer: footer ? <Designed design={footer} data={data} chrome /> : null,
    fonts: fontsUrl(designFonts(header, footer)),
  }
  // Pages with content filled in automatically get their kind's template.
  const templateFor = (file: string): TemplateKind | null => {
    if (file === 'index.html' || file.startsWith('p/')) return null
    const [first, second] = file.split('/')
    if (first === 'article') return 'article'
    if (first === 'section') return 'section'
    if (first === 'author') return 'author'
    if (first === 'tags' && second !== 'index.html') return 'tag'
    if (first === 'issues' && second !== 'index.html') return 'issue'
    return 'other'
  }
  const urls: string[] = []
  const page = async (file: string, meta: PageMeta, content: React.ReactNode) => {
    const kind = templateFor(file)
    const template = kind ? site.design.templates[kind] : undefined
    const body = template ? (
      <Templated template={template} data={data}>
        {content}
      </Templated>
    ) : (
      content
    )
    const fonts = fontsUrl(templateFonts(template))
    const styles = [
      ...(chrome.fonts ? [chrome.fonts] : []),
      ...(fonts ? [fonts] : []),
      ...(meta.styles ?? []),
    ]
    const image = meta.image ?? (shareImages ? `${SITE_URL}/share/site.png` : null)
    const html = renderToStaticMarkup(
      <Shell
        meta={{ ...meta, image, styles }}
        site={site}
        publicUrl={PUBLIC_URL}
        links={links}
        header={chrome.header}
        footer={chrome.footer}
      >
        {body}
      </Shell>,
    )
    await write(file, `<!doctype html>${html}`)
    if (!meta.noindex) urls.push(meta.path)
  }

  const { siteName, tagline } = site.settings

  // Link previews and icons. Previews need a full address, so they're skipped without one.
  const shareImages = Boolean(SITE_URL)
  await write('icons/icon-192.png', await iconImage(192, siteName.trim()[0] ?? 'B'))
  await write('icons/icon-512.png', await iconImage(512, siteName.trim()[0] ?? 'B'))
  await write('icons/apple-touch-icon.png', await iconImage(180, siteName.trim()[0] ?? 'B'))
  await write('favicon.ico', await iconImage(32, siteName.trim()[0] ?? 'B'))
  await write(
    'manifest.webmanifest',
    JSON.stringify({
      name: siteName,
      short_name: siteName,
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#121212',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    }),
  )
  if (shareImages) {
    await write('share/site.png', await siteShareImage({ siteName, tagline }))
    for (const article of articles) {
      if (!article.slug) continue
      const media = article.heroImage
      await write(
        `share/article/${article.slug}.png`,
        await storyShareImage({
          siteName,
          title: article.title,
          section: article.section?.name ?? null,
          imageUrl: media?.sizes?.hero?.url ?? media?.url ?? null,
        }),
      )
    }
  }

  // The designed front page once one is published; the classic one until then.
  if (site.design.design) {
    const fonts = fontsUrl(designFonts(site.design.design))
    await page(
      'index.html',
      { title: siteName, description: tagline, path: '/', styles: fonts ? [fonts] : [] },
      <DesignedHome design={site.design.design} data={data} />,
    )
  } else {
    await page(
      'index.html',
      { title: siteName, description: tagline, path: '/' },
      <HomeView layout={frontPageLayout(site, articles)} />,
    )
  }

  // Pages built in the site designer.
  for (const custom of customPages) {
    const fonts = fontsUrl(designFonts(custom.design))
    await page(
      `p/${custom.slug}/index.html`,
      {
        title: custom.title,
        description: custom.description || tagline,
        path: `/p/${custom.slug}/`,
        styles: fonts ? [fonts] : [],
      },
      <Designed design={custom.design} data={data} />,
    )
  }

  for (const section of site.sections) {
    const inSection = articles.filter((article) => article.section?.id === section.id)
    const pages = chunk(inSection, SECTION_PAGE_SIZE)
    for (const [index, items] of pages.entries()) {
      const n = index + 1
      const base = `/section/${section.slug}/`
      await page(
        n === 1 ? `section/${section.slug}/index.html` : `section/${section.slug}/${n}/index.html`,
        {
          title: n === 1 ? section.name : `${section.name} (page ${n})`,
          description: section.description ?? `${section.name} from ${siteName}.`,
          path: n === 1 ? base : `${base}${n}/`,
          feed: { title: section.name, path: `${base}feed.xml` },
        },
        <SectionView section={section} articles={items} page={n} pages={pages.length} />,
      )
    }
  }

  // Same section or a shared topic first, then newest; never the story itself.
  const relatedTo = (article: ExportArticle) => {
    const topics = new Set(article.tags.map((tag) => tag.id))
    const score = (other: ExportArticle) =>
      (other.section?.id === article.section?.id ? 2 : 0) +
      other.tags.filter((tag) => topics.has(tag.id)).length * 3
    return articles
      .filter((other) => other.id !== article.id && other.slug && score(other) > 0)
      .map((other, index) => ({ other, score: score(other), index }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, 3)
      .map(({ other }) => other)
  }

  for (const article of articles) {
    if (!article.slug) continue
    await page(
      `article/${article.slug}/index.html`,
      {
        title: article.title,
        description: article.summary,
        path: `/article/${article.slug}/`,
        image: shareImages ? `${SITE_URL}/share/article/${article.slug}.png` : null,
        type: 'article',
      },
      <ArticlePage
        article={article}
        shareUrl={SITE_URL ? `${SITE_URL}/article/${article.slug}/` : undefined}
        contact={links.contact}
        related={relatedTo(article)}
      />,
    )
  }

  const tagged = site.tags.map((tag) => ({
    tag,
    articles: articles.filter((article) => article.tags.some((item) => item.id === tag.id)),
  }))
  for (const { tag, articles: inTag } of tagged) {
    await page(
      `tags/${tag.slug}/index.html`,
      {
        title: tag.name,
        description: tag.description ?? `Stories about ${tag.name} from ${siteName}.`,
        path: `/tags/${tag.slug}/`,
        image: tag.image?.sizes?.hero?.url ?? tag.image?.url ?? null,
        feed: { title: tag.name, path: `/tags/${tag.slug}/feed.xml` },
      },
      <TagView tag={tag} articles={inTag} />,
    )
  }
  await page(
    'tags/index.html',
    { title: 'Topics', description: `Topics covered by ${siteName}.`, path: '/tags/' },
    <TagsView
      tags={tagged
        .filter((item) => item.articles.length > 0)
        .map(({ tag, articles: inTag }) => ({ tag, count: inTag.length }))}
    />,
  )

  const feed = (file: string, title: string, description: string, items: ExportArticle[]) =>
    write(
      file,
      rssFeed({ title, description, path: `/${file}`, siteUrl: SITE_URL, articles: items }),
    )
  await feed('feed.xml', siteName, tagline, articles)
  for (const section of site.sections) {
    await feed(
      `section/${section.slug}/feed.xml`,
      `${section.name} — ${siteName}`,
      section.description ?? `${section.name} from ${siteName}.`,
      articles.filter((article) => article.section?.id === section.id),
    )
  }
  for (const { tag, articles: inTag } of tagged) {
    await feed(
      `tags/${tag.slug}/feed.xml`,
      `${tag.name} — ${siteName}`,
      tag.description ?? `Stories about ${tag.name} from ${siteName}.`,
      inTag,
    )
  }
  await page(
    'subscribe/index.html',
    {
      title: 'Follow us',
      description: `Get new stories from ${siteName} in a feed reader.`,
      path: '/subscribe/',
    },
    <SubscribeView
      siteUrl={SITE_URL}
      feeds={[
        { title: `Every story`, path: '/feed.xml' },
        ...site.sections.map((section) => ({
          title: section.name,
          path: `/section/${section.slug}/feed.xml`,
        })),
      ]}
    />,
  )

  const authors = new Map<
    number,
    { author: ExportArticle['authors'][number]; articles: ExportArticle[] }
  >()
  for (const article of articles) {
    for (const author of article.authors) {
      if (!author.slug) continue
      const entry = authors.get(author.id) ?? { author, articles: [] }
      entry.articles.push(article)
      authors.set(author.id, entry)
    }
  }
  for (const { author, articles: written } of authors.values()) {
    await page(
      `author/${author.slug}/index.html`,
      {
        title: author.name,
        description: author.bio ?? `Stories by ${author.name}.`,
        path: `/author/${author.slug}/`,
      },
      <AuthorView author={author} articles={written} />,
    )
  }

  const byId = new Map(articles.map((article) => [article.id, article]))
  const siteStyles = await fs.readFile(path.join(ROOT, 'src/app/(frontend)/styles.css'), 'utf8')
  const prints = await buildPrintEditions({
    site,
    articles,
    publicUrl: PUBLIC_URL,
    styles: await printStyles(ROOT, `${FONT_VARIABLES}\n${siteStyles}`),
    write,
  })
  await page(
    'issues/index.html',
    { title: 'Issues', description: `Every edition of ${siteName}.`, path: '/issues/' },
    <IssuesView issues={site.issues} prints={prints} />,
  )
  for (const issue of site.issues) {
    const inIssue = issue.stories
      .map((id) => byId.get(id))
      .filter((article): article is ExportArticle => Boolean(article))
    await page(
      `issues/${editionSlug(issue)}/index.html`,
      {
        title: issue.title,
        description: `${issue.title}, ${siteName}.`,
        path: `/issues/${editionSlug(issue)}/`,
      },
      <IssueView issue={issue} articles={inIssue} print={prints.get(issue.id)} />,
    )
  }

  if (links.staff) {
    await page(
      'staff/index.html',
      {
        title: 'Our Staff',
        description: `The students who make ${siteName}.`,
        path: '/staff/',
      },
      <StaffView
        staff={site.staff}
        authorPages={new Set(authors.keys())}
        joinUs={site.settings.joinUs}
        contact={links.contact}
      />,
    )
  }
  if (links.contact) {
    await page(
      'contact/index.html',
      {
        title: 'Contact the newsroom',
        description: `Letters, tips and corrections for ${siteName}.`,
        path: '/contact/',
        scripts: [TURNSTILE_SCRIPT],
      },
      <ContactView
        endpoint={`${site.cmsUrl}/api/submissions/submit`}
        siteKey={TURNSTILE_SITE_KEY}
      />,
    )
  }

  // Scores, the calendar and live coverage are drawn in the browser from /api/live.
  await page(
    'scores/index.html',
    {
      title: 'Scores & Schedule',
      description: `Bur Oak teams’ results and upcoming games.`,
      path: '/scores/',
    },
    <LiveShell
      id="scores-page"
      title="Scores & Schedule"
      intro="Results and upcoming games for Bur Oak teams. Live scores update by themselves."
    />,
  )
  await page(
    'calendar/index.html',
    { title: 'Calendar', description: `What’s on at Bur Oak.`, path: '/calendar/' },
    <LiveShell id="calendar-page" title="Calendar" intro="What’s coming up at Bur Oak." />,
  )
  await page(
    'live/index.html',
    { title: 'Live', description: `Live coverage from ${siteName}.`, path: '/live/' },
    <LiveShell
      id="live-page"
      title="Live coverage"
      intro="Updates as they happen. This page refreshes by itself."
    />,
  )

  if (site.settings.standards) {
    await page(
      'standards/index.html',
      {
        title: 'Our standards',
        description: `How ${siteName} reports, checks and corrects the news.`,
        path: '/standards/',
      },
      <StandardsView site={site} />,
    )
  }
  if (site.settings.about) {
    await page(
      'about/index.html',
      { title: 'About', description: tagline, path: '/about/' },
      <AboutView site={site} />,
    )
  }
  await page(
    'search/index.html',
    { title: 'Search', description: `Search ${siteName}.`, path: '/search/', noindex: true },
    <SearchView />,
  )
  await page(
    '404.html',
    { title: 'Page not found', description: tagline, path: '/404', noindex: true },
    <NotFoundView />,
  )

  await write(
    'search-index.json',
    JSON.stringify(
      articles
        .filter((article) => article.slug)
        .map((article) => ({
          t: article.title,
          s: article.summary,
          u: article.slug,
          c: article.section?.name ?? '',
          a: article.authors.map((author) => author.name).join(', '),
          g: article.tags.map((tag) => tag.name).join(', '),
          d: formatDate(article.publishedAt),
        })),
    ),
  )

  // Dark mode is for the public site only; the print edition stays black on white.
  const theme = await fs.readFile(path.join(ROOT, 'src/site/theme.css'), 'utf8')
  const designCss = await fs.readFile(path.join(ROOT, 'src/design/design.css'), 'utf8')
  await write('assets/styles.css', `${FONT_VARIABLES}\n\n${siteStyles}\n${theme}\n${designCss}`)
  await write('assets/site.js', await fs.readFile(path.join(ROOT, 'src/site/site.js'), 'utf8'))
  await write(
    '_headers',
    [
      '/assets/*',
      '  Cache-Control: public, max-age=3600',
      '/search-index.json',
      '  Cache-Control: public, max-age=300',
      '/issues/*.pdf',
      '  Cache-Control: public, max-age=86400',
      '',
    ].join('\n'),
  )
  if (PUBLIC_URL) {
    await write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${PUBLIC_URL}/sitemap.xml\n`)
    await write(
      'sitemap.xml',
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
        .map((url) => `  <url><loc>${PUBLIC_URL}${url}</loc></url>`)
        .join('\n')}\n</urlset>\n`,
    )
  }

  console.log(
    `Built ${urls.length} pages: ${articles.length} stories, ${site.sections.length} sections, ${site.tags.length} topics, ${authors.size} authors, ${site.issues.length} issues.`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
