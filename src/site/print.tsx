/**
 * Print editions for the public site: a printable page for each issue that has
 * one, and a PDF of it made with headless Chromium during the Cloudflare build.
 *
 * A PDF whose issue hasn't changed is copied from the live site rather than
 * made again. If Chromium can't run, the build carries on and the issue links
 * to the printable page instead.
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { PrintEdition } from '@/components/print/PrintEdition'
import type { IssueStory } from '@/lib/data'
import { placeOf } from '@/lib/positions'

import { asArticle, editionSlug, type ExportArticle, type ExportMeta } from './model'
import type { PrintLinks } from './views'

type Browser = Awaited<ReturnType<(typeof import('puppeteer-core'))['launch']>>

const FONTS =
  'https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;600;700&family=Manufacturing+Consent&family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..700&display=swap'

const launchBrowser = async (): Promise<Browser> => {
  const puppeteer = await import('puppeteer-core')
  const local =
    process.env.CHROME_PATH ??
    (process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : process.platform === 'win32'
        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        : null)
  if (local) return puppeteer.launch({ executablePath: local, headless: true })
  // Linux build machines (Cloudflare Pages) use the self-contained Chromium build.
  const chromium = (await import('@sparticuz/chromium')).default
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  })
}

const pageHtml = ({ body, title, styles }: { body: string; title: string; styles: string }) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"/>` +
  `<meta name="viewport" content="width=device-width, initial-scale=1"/>` +
  `<meta name="robots" content="noindex"/><title>${title}</title>` +
  `<link rel="preconnect" href="https://fonts.googleapis.com"/>` +
  `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin=""/>` +
  `<link rel="stylesheet" href="${FONTS}"/><style>${styles}</style></head>` +
  `<body>${body}<script>document.querySelectorAll('[data-print]').forEach(function(b){b.addEventListener('click',function(){window.print()})})</script></body></html>`

export const buildPrintEditions = async ({
  site,
  articles,
  publicUrl,
  styles,
  write,
}: {
  site: ExportMeta
  articles: ExportArticle[]
  publicUrl: string
  /** The site's stylesheet plus the print stylesheet. */
  styles: string
  write: (file: string, contents: string | Buffer) => Promise<void>
}): Promise<PrintLinks> => {
  const links: PrintLinks = new Map()
  const byId = new Map(articles.map((article) => [article.id, article]))
  // The staff box lists the most senior positions first, as on a masthead.
  const staffBox = site.staff
    .filter((person) => person.title)
    .map((person) => ({ person, order: placeOf(person.positions)?.order ?? 999 }))
    .sort((a, b) => a.order - b.order)
    .map(({ person }) => ({ name: person.name, title: person.title as string }))

  let browser: Browser | null = null
  let browserFailed: string | null = null
  const counts = { made: 0, reused: 0, printableOnly: 0 }

  try {
    for (const issue of site.issues) {
      if (!issue.printEdition || !issue.print) continue
      const slug = editionSlug(issue)
      const stories: IssueStory[] = issue.print.stories.flatMap((story) => {
        const article = byId.get(story.id)
        return article
          ? [{ article: asArticle(article), width: story.width, showImage: story.showImage }]
          : []
      })
      if (stories.length === 0) continue
      const staff = issue.print.showStaffBox ? staffBox : []

      const render = (toolbar?: React.ReactNode) =>
        renderToStaticMarkup(
          <PrintEdition
            issue={{
              title: issue.title,
              volume: issue.volume,
              number: issue.number,
              date: issue.date,
              announcement: issue.print!.announcement,
              showContents: issue.print!.showContents,
              paperSize: issue.print!.paperSize,
            }}
            stories={stories}
            siteName={site.settings.siteName}
            staff={staff}
            toolbar={toolbar}
          />,
        )

      // The PDF's name changes whenever anything printed in it changes.
      const fingerprint = createHash('sha256')
        .update(
          JSON.stringify({
            issue: [issue.title, issue.date, issue.print],
            stories: stories.map(({ article }) => [article.id, article.updatedAt]),
            staff,
            siteName: site.settings.siteName,
          }),
        )
        .digest('hex')
        .slice(0, 10)
      const pdfName = `boss-today-vol${issue.volume}-no${issue.number}-${fingerprint}.pdf`
      const pdfPath = `/issues/${slug}/${pdfName}`

      let pdf: Buffer | null = null
      if (publicUrl) {
        try {
          const response = await fetch(`${publicUrl}${pdfPath}`)
          if (response.ok && response.headers.get('content-type')?.includes('pdf')) {
            pdf = Buffer.from(await response.arrayBuffer())
            counts.reused++
          }
        } catch {
          // Not on the live site yet: make it below.
        }
      }
      if (!pdf && !browserFailed) {
        try {
          browser ??= await launchBrowser()
          const page = await browser.newPage()
          await page.setContent(pageHtml({ body: render(), title: issue.title, styles }), {
            waitUntil: 'load',
            timeout: 60_000,
          })
          // Photos and web fonts finish loading after the page itself.
          await page.waitForNetworkIdle({ idleTime: 500, timeout: 60_000 })
          await page.emulateMediaType('print')
          await page.evaluate(() => document.fonts.ready)
          pdf = Buffer.from(await page.pdf({ preferCSSPageSize: true, printBackground: true }))
          await page.close()
          counts.made++
        } catch (error) {
          browserFailed = error instanceof Error ? error.message : String(error)
          console.warn(
            `Could not make print edition PDFs (${browserFailed}). Issues will link to their printable pages instead.`,
          )
        }
      }
      if (pdf) await write(path.posix.join('issues', slug, pdfName), pdf)

      const printPath = `/issues/${slug}/print/`
      await write(
        path.posix.join('issues', slug, 'print', 'index.html'),
        pageHtml({
          title: `${issue.title} — print edition`,
          styles,
          body: render(
            <>
              <a href={`/issues/${slug}/`}>← Back to the issue</a>
              <span className="print-toolbar__actions">
                {pdf && (
                  <a className="button button--secondary" href={pdfPath}>
                    Download PDF
                  </a>
                )}
                <button type="button" className="button" data-print="">
                  Print or save as PDF
                </button>
              </span>
            </>,
          ),
        }),
      )
      if (!pdf) counts.printableOnly++
      links.set(issue.id, pdf ? { href: pdfPath, pdf: true } : { href: printPath, pdf: false })
    }
  } finally {
    if (browser) await browser.close()
  }
  if (links.size > 0) {
    console.log(
      `Print editions: ${counts.made} PDF made, ${counts.reused} reused` +
        (counts.printableOnly ? `, ${counts.printableOnly} printable page only` : '') +
        '.',
    )
  }

  return links
}

/** Reads the stylesheets the print pages need. */
export const printStyles = async (root: string, siteStyles: string) =>
  `${siteStyles}\n${await fs.readFile(path.join(root, 'src/components/print/print.css'), 'utf8')}`
