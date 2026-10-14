const list = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)

export const googleConfig = () => ({
  clientId: process.env.GOOGLE_CLIENT_ID ?? '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  /** Emails that become admins on first sign-in, so the first account does not need an invite. */
  adminEmails: list(process.env.ADMIN_EMAILS),
  /** If set, only Google accounts on these domains may sign in. */
  allowedDomains: list(process.env.ALLOWED_EMAIL_DOMAINS),
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
