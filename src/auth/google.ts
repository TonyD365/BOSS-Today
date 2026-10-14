import { envList, superAdminEmails } from '../lib/env'

/** York Region DSB student and staff accounts. Override with ALLOWED_EMAIL_DOMAINS. */
const SCHOOL_DOMAINS = ['gapps.yrdsb.ca', 'yrdsb.ca']

export const googleConfig = () => ({
  clientId: process.env.GOOGLE_CLIENT_ID ?? '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  superAdminEmails: superAdminEmails(),
  allowedDomains: process.env.ALLOWED_EMAIL_DOMAINS
    ? envList(process.env.ALLOWED_EMAIL_DOMAINS)
    : SCHOOL_DOMAINS,
  /** Off until there is something for readers to do once signed in. */
  allowReaderSignup: process.env.ALLOW_READER_SIGNUP === 'true',
})

/** The public origin of the site, used to build the OAuth redirect address. */
export const siteOrigin = (request: Request): string => {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '')
  const url = new URL(request.url)
  const host = request.headers.get('x-forwarded-host') ?? url.host
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
  return `${proto}://${host}`
}

export const STATE_COOKIE = 'boss-oauth-state'
