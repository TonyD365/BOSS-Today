import { siteOrigin } from '@/auth/google'
import { parseEdition } from '@/lib/data'

// Rendering a full issue can take a while on a cold start.
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const launchBrowser = async () => {
  const puppeteer = await import('puppeteer-core')
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const chromium = (await import('@sparticuz/chromium')).default
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  }
  // Local development uses the installed Chrome.
  const executablePath =
    process.env.CHROME_PATH ??
    (process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : process.platform === 'win32'
        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        : '/usr/bin/google-chrome')
  return puppeteer.launch({ executablePath, headless: true })
}

/** GET /issues/:edition/pdf — the print edition as a ready-to-print PDF. */
export async function GET(request: Request, { params }: { params: Promise<{ edition: string }> }) {
  const { edition } = await params
  const parsed = parseEdition(edition)
  if (!parsed) return new Response('Not found', { status: 404 })

  // Only the session cookie is passed on, so staff can download draft proofs.
  const session = /(?:^|;\s*)(payload-token=[^;]+)/.exec(request.headers.get('cookie') ?? '')?.[1]
  const origin = siteOrigin(request)

  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    if (session) await page.setExtraHTTPHeaders({ cookie: session })
    const response = await page.goto(`${origin}/issues/${parsed.volume}-${parsed.number}/print`, {
      waitUntil: 'networkidle0',
      timeout: 45_000,
    })
    if (!response || response.status() !== 200) {
      return new Response('Not found', { status: response?.status() === 404 ? 404 : 502 })
    }
    await page.emulateMediaType('print')
    await page.evaluate(() => document.fonts.ready)
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true })

    return new Response(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="boss-today-vol${parsed.volume}-no${parsed.number}.pdf"`,
        'Cache-Control': session ? 'private, no-store' : 'public, s-maxage=600',
      },
    })
  } finally {
    await browser.close()
  }
}
