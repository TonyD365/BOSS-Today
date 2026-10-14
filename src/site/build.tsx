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

import {
  byNewest,
  chunk,
  editionSlug,
  type ExportArticle,
  type ExportMeta,
  frontPageLayout,
} from './model'
import {
  AboutView,
  ArticlePage,
  AuthorView,
  HomeView,
  IssuesView,
  IssueView,
  NotFoundView,
  type PageMeta,
  SearchView,
  SectionView,
  Shell,
} from './views'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'site-dist')
const SECTION_PAGE_SIZE = 20

const required = (name: string) => {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Set ${name} to build the public site.`)
  return value
}

const CMS_URL = required('CMS_URL').replace(/\/$/, '')
const TOKEN = required('SITE_EXPORT_TOKEN')
const PUBLIC_URL = (process.env.PUBLIC_SITE_URL ?? '').replace(/\/$/, '')

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

const write = async (file: string, contents: string) => {
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

  const urls: string[] = []
  const page = async (file: string, meta: PageMeta, body: React.ReactNode) => {
    const html = renderToStaticMarkup(
      <Shell meta={meta} site={site} publicUrl={PUBLIC_URL}>
        {body}
      </Shell>,
    )
    await write(file, `<!doctype html>${html}`)
    if (!meta.noindex) urls.push(meta.path)
  }

  const { siteName, tagline } = site.settings

  await page(
    'index.html',
    { title: siteName, description: tagline, path: '/' },
    <HomeView layout={frontPageLayout(site, articles)} />,
  )

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
        },
        <SectionView section={section} articles={items} page={n} pages={pages.length} />,
      )
    }
  }

  for (const article of articles) {
    if (!article.slug) continue
    await page(
      `article/${article.slug}/index.html`,
      {
        title: article.title,
        description: article.summary,
        path: `/article/${article.slug}/`,
        image: article.heroImage?.sizes?.hero?.url ?? article.heroImage?.url ?? null,
        type: 'article',
      },
      <ArticlePage article={article} />,
    )
  }

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
  await page(
    'issues/index.html',
    { title: 'Issues', description: `Every edition of ${siteName}.`, path: '/issues/' },
    <IssuesView issues={site.issues} cmsUrl={site.cmsUrl} />,
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
      <IssueView issue={issue} articles={inIssue} cmsUrl={site.cmsUrl} />,
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
          d: formatDate(article.publishedAt),
        })),
    ),
  )

  const styles = await fs.readFile(path.join(ROOT, 'src/app/(frontend)/styles.css'), 'utf8')
  await write(
    'assets/styles.css',
    `:root {\n  --font-masthead: 'Manufacturing Consent';\n  --font-serif: 'Newsreader';\n  --font-sans: 'Libre Franklin';\n}\n\n${styles}`,
  )
  await write('assets/site.js', await fs.readFile(path.join(ROOT, 'src/site/site.js'), 'utf8'))
  await write(
    '_headers',
    [
      '/assets/*',
      '  Cache-Control: public, max-age=3600',
      '/search-index.json',
      '  Cache-Control: public, max-age=300',
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
    `Built ${urls.length} pages: ${articles.length} stories, ${site.sections.length} sections, ${authors.size} authors, ${site.issues.length} issues.`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
