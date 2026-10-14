import type { ExportArticle } from './model'

export const FEED_SIZE = 30

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
  )

/** An RSS 2.0 feed of the newest stories. `siteUrl` makes every link absolute. */
export const rssFeed = ({
  title,
  description,
  path,
  siteUrl,
  articles,
}: {
  title: string
  description: string
  path: string
  siteUrl: string
  articles: ExportArticle[]
}) => {
  const items = articles
    .filter((article) => article.slug)
    .slice(0, FEED_SIZE)
    .map((article) => {
      const link = `${siteUrl}/article/${article.slug}/`
      return [
        '    <item>',
        `      <title>${escape(article.title)}</title>`,
        `      <link>${escape(link)}</link>`,
        `      <guid isPermaLink="true">${escape(link)}</guid>`,
        article.publishedAt
          ? `      <pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>`
          : '',
        `      <description>${escape(article.summary ?? '')}</description>`,
        article.section ? `      <category>${escape(article.section.name)}</category>` : '',
        article.authors.length > 0
          ? `      <dc:creator>${escape(article.authors.map((author) => author.name).join(', '))}</dc:creator>`
          : '',
        '    </item>',
      ]
        .filter(Boolean)
        .join('\n')
    })

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    '  <channel>',
    `    <title>${escape(title)}</title>`,
    `    <link>${escape(`${siteUrl}${path.replace(/feed\.xml$/, '')}`)}</link>`,
    `    <atom:link href="${escape(`${siteUrl}${path}`)}" rel="self" type="application/rss+xml" />`,
    `    <description>${escape(description)}</description>`,
    '    <language>en-ca</language>',
    articles[0]?.publishedAt
      ? `    <lastBuildDate>${new Date(articles[0].publishedAt).toUTCString()}</lastBuildDate>`
      : '',
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ]
    .filter(Boolean)
    .join('\n')
}
