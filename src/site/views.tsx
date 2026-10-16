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
  type ExportStaff,
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
  /** Extra scripts this page alone needs. */
  scripts?: string[]
}

/** Footer links that depend on what the site has. */
export type SiteLinks = { staff: boolean; contact: boolean }

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
  links,
  children,
}: {
  meta: PageMeta
  site: ExportMeta
  publicUrl: string
  links: SiteLinks
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
        {(meta.scripts ?? []).map((src) => (
          <script key={src} src={src} async defer />
        ))}
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
              { label: 'Scores', href: '/scores/' },
              { label: 'Calendar', href: '/calendar/' },
              ...(links.staff ? [{ label: 'Our Staff', href: '/staff/' }] : []),
              ...(links.contact ? [{ label: 'Contact us', href: '/contact/' }] : []),
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
      {/* Filled in by site.js from /api/live when something is being covered live. */}
      <div id="live-strip" className="live-strip" hidden />
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
        <aside className="front__rail" aria-label="Latest and most read">
          {latest.length > 0 && (
            <>
              <h2 className="rail-title">Latest</h2>
              {latest.map((article) => (
                <StoryCard
                  key={article.id}
                  article={asArticle(article)}
                  variant="compact"
                  showSection
                />
              ))}
            </>
          )}
          {/* Filled in by site.js from /api/live; updated hourly without a rebuild. */}
          <section id="most-read" className="most-read" aria-label="Most read this week" hidden>
            <h2 className="rail-title">Most read this week</h2>
            <ol />
          </section>
          <section id="scores-box" className="board-box" aria-label="Scores" hidden>
            <h2 className="rail-title">
              <a href="/scores/">Scores</a>
            </h2>
            <ul />
          </section>
          <section id="events-box" className="board-box" aria-label="This week at Bur Oak" hidden>
            <h2 className="rail-title">
              <a href="/calendar/">This week at Bur Oak</a>
            </h2>
            <ul />
          </section>
        </aside>
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

export function ArticlePage({
  article,
  shareUrl,
  contact,
}: {
  article: ExportArticle
  shareUrl?: string
  contact: boolean
}) {
  return (
    <>
      <ArticleView article={asArticle(article)} shareUrl={shareUrl} />
      {contact && (
        <p className="article__report">
          Spotted a mistake?{' '}
          <a href={`/contact/?type=correction&article=${encodeURIComponent(article.slug)}`}>
            Tell us
          </a>
          .
        </p>
      )}
    </>
  )
}

const STAFF_GROUPS: { role: ExportStaff['role']; title: string }[] = [
  { role: 'exec', title: 'Editorial board' },
  { role: 'editor', title: 'Editors' },
  { role: 'reporter', title: 'Reporters and writers' },
]

export function StaffView({
  staff,
  authorPages,
  joinUs,
  contact,
}: {
  staff: ExportStaff[]
  /** Staff with an author page (anyone with a published story). */
  authorPages: Set<number>
  joinUs: unknown
  contact: boolean
}) {
  return (
    <div className="listing">
      <header className="listing__header">
        <h1>Our Staff</h1>
        <p>The students who report, edit and publish BOSS Today.</p>
      </header>
      {STAFF_GROUPS.map(({ role, title }) => {
        const people = staff.filter((person) => person.role === role)
        if (people.length === 0) return null
        return (
          <section key={role} className="staff-group" aria-label={title}>
            <h2 className="section-block__title">{title}</h2>
            <ul className="staff-list">
              {people.map((person) => (
                <li key={person.id}>
                  {person.photo ? (
                    <Picture media={person.photo} sizes="72px" className="avatar" />
                  ) : (
                    <span className="avatar avatar--empty" aria-hidden="true">
                      {person.name.slice(0, 1)}
                    </span>
                  )}
                  <div>
                    <h3>
                      {authorPages.has(person.id) && person.slug ? (
                        <a href={`/author/${person.slug}/`}>{person.name}</a>
                      ) : (
                        person.name
                      )}
                    </h3>
                    {person.title && <p className="kicker">{person.title}</p>}
                    {person.bio && <p>{person.bio}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      {(Boolean(joinUs) || contact) && (
        <section className="join-us" aria-label="Join us">
          <h2 className="section-block__title">Join us</h2>
          {Boolean(joinUs) && <ArticleBody className="article__body" content={joinUs} />}
          {contact && (
            <p>
              Have a story idea? <a href="/contact/?type=tip">Send us a tip</a>.
            </p>
          )}
        </section>
      )}
    </div>
  )
}

export function ContactView({ endpoint, siteKey }: { endpoint: string; siteKey: string }) {
  return (
    <div className="listing contact">
      <header className="listing__header">
        <h1>Contact the newsroom</h1>
        <p>
          Write a letter to the editor, send us a news tip, or tell us about a mistake in a story.
        </p>
      </header>
      <ul className="contact__rules">
        <li>
          Use your <b>real first and last name</b> and an email address you check. We don’t accept
          anonymous submissions.
        </li>
        <li>
          Before we publish a letter, an editor will email you to confirm it’s really from you.
        </li>
        <li>Letters may be edited for length, clarity and accuracy, and may not be published.</li>
        <li>
          Only our editors see your email address, and we delete it 180 days after dealing with your
          message.
        </li>
      </ul>
      <form className="contact__form" data-endpoint={endpoint} noValidate>
        <fieldset>
          <legend>What are you sending?</legend>
          <label>
            <input type="radio" name="kind" value="letter" defaultChecked /> A letter to the editor
          </label>
          <label>
            <input type="radio" name="kind" value="tip" /> A news tip
          </label>
          <label>
            <input type="radio" name="kind" value="correction" /> A correction to a story
          </label>
        </fieldset>
        <p className="contact__about" hidden />
        <label>
          Your message
          <textarea name="body" rows={9} maxLength={3000} required />
          <span className="contact__count" aria-live="polite">
            0 / 3000
          </span>
        </label>
        <div className="contact__row">
          <label>
            First and last name
            <input name="name" autoComplete="name" required maxLength={100} />
          </label>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required maxLength={255} />
          </label>
          <label>
            Grade or role <span className="contact__optional">(e.g. Grade 11, Parent)</span>
            <input name="affiliation" maxLength={80} />
          </label>
        </div>
        <label className="contact__trap" aria-hidden="true">
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
        <label className="contact__consent">
          <input type="checkbox" name="consent" required /> I’m sending this under my real name. I
          understand BOSS Today may contact me to confirm it, and may edit and publish what I send.
        </label>
        <div className="cf-turnstile" data-sitekey={siteKey} />
        <button type="submit" className="button">
          Send
        </button>
        <p className="contact__status" role="status" aria-live="polite" />
      </form>
    </div>
  )
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

/** Where an issue's print edition is: its PDF, or the printable page if the PDF couldn't be made. */
export type PrintLinks = Map<number, { href: string; pdf: boolean }>

export function IssuesView({ issues, prints }: { issues: ExportIssue[]; prints: PrintLinks }) {
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
            {prints.get(issue.id) && (
              <a className="issue-list__print" href={prints.get(issue.id)!.href}>
                {prints.get(issue.id)!.pdf ? 'Print edition (PDF)' : 'Print edition'}
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
  print,
}: {
  issue: ExportIssue
  articles: ExportArticle[]
  print?: { href: string; pdf: boolean }
}) {
  return (
    <div className="listing">
      <header className="listing__header">
        <p className="kicker">
          {editionLabel(issue)} · {formatDate(issue.date)}
        </p>
        <h1>{issue.title}</h1>
        {print && (
          <p>
            <a className="button" href={print.href}>
              {print.pdf ? 'Download the print edition (PDF)' : 'Open the print edition'}
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

/** A page whose content site.js fills in from /api/live, so it changes without a rebuild. */
export function LiveShell({
  id,
  title,
  intro,
}: {
  id: 'scores-page' | 'calendar-page' | 'live-page'
  title: string
  intro: string
}) {
  return (
    <div className="listing">
      <header className="listing__header">
        <h1 data-live-title="">{title}</h1>
        <p data-live-intro="">{intro}</p>
      </header>
      <div id={id} className="board-page" aria-live="polite">
        <p className="listing__empty">Loading…</p>
      </div>
      <noscript>
        <p className="listing__empty">This page needs JavaScript to show the latest updates.</p>
      </noscript>
    </div>
  )
}
