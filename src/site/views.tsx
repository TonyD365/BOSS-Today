import React from 'react'

import { ArticleBody } from '@/components/site/ArticleBody'
import { ArticleView } from '@/components/site/ArticleView'
import { Footer } from '@/components/site/Footer'
import { Header } from '@/components/site/Header'
import { Picture } from '@/components/site/Picture'
import { StoryCard } from '@/components/site/StoryCard'
import { editionLabel, formatDate } from '@/lib/format'

import {
  asArticle,
  editionSlug,
  type ExportArticle,
  type ExportIssue,
  type ExportMeta,
  type ExportSection,
  type ExportTag,
  type frontPageLayout,
} from './model'

export type PageMeta = {
  title: string
  description: string
  path: string
  image?: string | null
  type?: 'website' | 'article'
  noindex?: boolean
  /** An RSS feed for this page, besides the site-wide one. */
  feed?: { title: string; path: string }
}

/** Runs before the page paints, so a reader's chosen theme never flashes. */
const THEME_SCRIPT =
  "try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}"

const FONTS =
  'https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;600;700&family=Manufacturing+Consent&family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..700&display=swap'

/** The full HTML document around every page. */
export function Shell({
  meta,
  site,
  publicUrl,
  children,
}: {
  meta: PageMeta
  site: ExportMeta
  publicUrl: string
  children: React.ReactNode
}) {
  const fullTitle =
    meta.title === site.settings.siteName ? meta.title : `${meta.title} — ${site.settings.siteName}`
  const canonical = publicUrl ? `${publicUrl}${meta.path}` : meta.path
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{fullTitle}</title>
        <meta name="description" content={meta.description} />
        <link rel="canonical" href={canonical} />
        {meta.noindex && <meta name="robots" content="noindex" />}
        <meta property="og:site_name" content={site.settings.siteName} />
        <meta property="og:type" content={meta.type ?? 'website'} />
        <meta property="og:title" content={meta.title} />
        <meta property="og:description" content={meta.description} />
        <meta property="og:url" content={canonical} />
        {meta.image && <meta property="og:image" content={meta.image} />}
        <meta name="twitter:card" content={meta.image ? 'summary_large_image' : 'summary'} />
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link
          rel="alternate"
          type="application/rss+xml"
          title={site.settings.siteName}
          href="/feed.xml"
        />
        {meta.feed && (
          <link
            rel="alternate"
            type="application/rss+xml"
            title={`${meta.feed.title} — ${site.settings.siteName}`}
            href={meta.feed.path}
          />
        )}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
        <link rel="stylesheet" href="/assets/styles.css" />
        <script src="/assets/site.js" defer />
      </head>
      <body>
        {/* Filled in by site.js from /api/banner, so the banner never needs a rebuild. */}
        <div id="site-banner" hidden />
        <div className="site">
          <Header sections={site.sections} settings={site.settings} />
          <main>{children}</main>
          <Footer
            sections={site.sections}
            settings={{ ...site.settings, about: site.settings.about as never }}
            staffUrl={`${site.cmsUrl}/admin`}
            links={[
              ...(site.tags.length > 0 ? [{ label: 'Topics', href: '/tags/' }] : []),
              { label: 'RSS', href: '/feed.xml' },
            ]}
          />
        </div>
      </body>
    </html>
  )
}

export function HomeView({ layout }: { layout: ReturnType<typeof frontPageLayout> }) {
  const { lead, featured, latest, bySection } = layout
  if (!lead) {
    return (
      <div className="empty">
        <h1>The first edition is on its way.</h1>
        <p>No stories have been published yet.</p>
      </div>
    )
  }
  return (
    <>
      <section className="front" aria-label="Top stories">
        <div className="front__main">
          <StoryCard article={asArticle(lead)} variant="lead" showSection />
          {featured.length > 0 && (
            <div className="front__featured">
              {featured.map((article) => (
                <StoryCard key={article.id} article={asArticle(article)} showSection />
              ))}
            </div>
          )}
        </div>
        {latest.length > 0 && (
          <aside className="front__rail" aria-label="Latest">
            <h2 className="rail-title">Latest</h2>
            {latest.map((article) => (
              <StoryCard
                key={article.id}
                article={asArticle(article)}
                variant="compact"
                showSection
              />
            ))}
          </aside>
        )}
      </section>
      {bySection.map(({ section, articles }) => (
        <section className="section-block" key={section.id} aria-label={section.name}>
          <h2 className="section-block__title">
            <a href={`/section/${section.slug}/`}>{section.name}</a>
          </h2>
          <div className="section-block__grid">
            {articles.map((article, index) => (
              <StoryCard key={article.id} article={asArticle(article)} showImage={index === 0} />
            ))}
          </div>
        </section>
      ))}
    </>
  )
}

export function SectionView({
  section,
  articles,
  page,
  pages,
}: {
  section: ExportSection
  articles: ExportArticle[]
  page: number
  pages: number
}) {
  const href = (n: number) =>
    n === 1 ? `/section/${section.slug}/` : `/section/${section.slug}/${n}/`
  return (
    <div className="listing">
      <header className="listing__header">
        <h1>{section.name}</h1>
        {section.description && <p>{section.description}</p>}
      </header>
      {articles.length === 0 && <p className="listing__empty">No stories here yet.</p>}
      {articles.map((article) => (
        <StoryCard key={article.id} article={asArticle(article)} variant="row" />
      ))}
      <nav className="pager" aria-label="Pages">
        {page > 1 ? <a href={href(page - 1)}>← Newer stories</a> : <span />}
        {page < pages && <a href={href(page + 1)}>Older stories →</a>}
      </nav>
    </div>
  )
}

export function ArticlePage({ article, shareUrl }: { article: ExportArticle; shareUrl?: string }) {
  return <ArticleView article={asArticle(article)} shareUrl={shareUrl} />
}

export function TagView({ tag, articles }: { tag: ExportTag; articles: ExportArticle[] }) {
  return (
    <div className="listing">
      <header className="listing__header">
        <p className="kicker">Topic</p>
        <h1>{tag.name}</h1>
        {tag.description && <p>{tag.description}</p>}
        <p className="listing__feed">
          <a href={`/tags/${tag.slug}/feed.xml`}>RSS feed for this topic</a>
        </p>
      </header>
      {tag.image && (
        <Picture
          media={tag.image}
          sizes="(min-width: 900px) 860px, 100vw"
          className="listing__image"
        />
      )}
      {articles.length === 0 && <p className="listing__empty">No stories here yet.</p>}
      {articles.map((article) => (
        <StoryCard key={article.id} article={asArticle(article)} variant="row" showSection />
      ))}
    </div>
  )
}

export function TagsView({ tags }: { tags: { tag: ExportTag; count: number }[] }) {
  return (
    <div className="listing">
      <header className="listing__header">
        <h1>Topics</h1>
        <p>Stories that belong together, across every section.</p>
      </header>
      {tags.length === 0 && <p className="listing__empty">No topics yet.</p>}
      <ul className="tag-list">
        {tags.map(({ tag, count }) => (
          <li key={tag.id}>
            <a href={`/tags/${tag.slug}/`}>{tag.name}</a>
            <span>
              {count} {count === 1 ? 'story' : 'stories'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function AuthorView({
  author,
  articles,
}: {
  author: ExportArticle['authors'][number]
  articles: ExportArticle[]
}) {
  return (
    <div className="listing">
      <header className="listing__header listing__header--author">
        {author.photo && <Picture media={author.photo} sizes="96px" className="avatar" />}
        <div>
          <h1>{author.name}</h1>
          {author.title && <p className="kicker">{author.title}</p>}
          {author.bio && <p>{author.bio}</p>}
        </div>
      </header>
      {articles.map((article) => (
        <StoryCard key={article.id} article={asArticle(article)} variant="row" showSection />
      ))}
    </div>
  )
}

export function IssuesView({ issues, cmsUrl }: { issues: ExportIssue[]; cmsUrl: string }) {
  return (
    <div className="listing">
      <header className="listing__header">
        <h1>Issues</h1>
        <p>Every edition of BOSS Today, newest first.</p>
      </header>
      {issues.length === 0 && <p className="listing__empty">No issues have been published yet.</p>}
      <ul className="issue-list">
        {issues.map((issue) => (
          <li key={issue.id}>
            <a className="issue-list__title" href={`/issues/${editionSlug(issue)}/`}>
              {issue.title}
            </a>
            <span className="issue-list__meta">
              {editionLabel(issue)} · {formatDate(issue.date)}
            </span>
            {issue.printEdition && (
              <a className="issue-list__print" href={`${cmsUrl}/issues/${editionSlug(issue)}/pdf`}>
                Print edition (PDF)
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function IssueView({
  issue,
  articles,
  cmsUrl,
}: {
  issue: ExportIssue
  articles: ExportArticle[]
  cmsUrl: string
}) {
  return (
    <div className="listing">
      <header className="listing__header">
        <p className="kicker">
          {editionLabel(issue)} · {formatDate(issue.date)}
        </p>
        <h1>{issue.title}</h1>
        {issue.printEdition && (
          <p>
            <a className="button" href={`${cmsUrl}/issues/${editionSlug(issue)}/pdf`}>
              Download the print edition (PDF)
            </a>
          </p>
        )}
      </header>
      {articles.map((article) => (
        <StoryCard key={article.id} article={asArticle(article)} variant="row" showSection />
      ))}
    </div>
  )
}

export function AboutView({ site }: { site: ExportMeta }) {
  return (
    <article className="article">
      <header className="article__header">
        <h1>About {site.settings.siteName}</h1>
        <p className="article__summary">{site.settings.tagline}</p>
      </header>
      <ArticleBody className="article__body" content={site.settings.about} />
    </article>
  )
}

export function SearchView() {
  return (
    <div className="listing">
      <header className="listing__header">
        <h1>Search</h1>
        <form className="search-form" action="/search/" role="search">
          <label className="visually-hidden" htmlFor="search-page-input">
            Search stories
          </label>
          <input id="search-page-input" type="search" name="q" autoFocus />
          <button type="submit">Search</button>
        </form>
      </header>
      <div id="search-results" aria-live="polite" />
    </div>
  )
}

export function NotFoundView() {
  return (
    <div className="empty">
      <h1>Page not found</h1>
      <p>This page does not exist, or the story has been taken down.</p>
      <a href="/">Go to the front page</a>
    </div>
  )
}
