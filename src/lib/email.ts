/**
 * Outgoing email (sign-in codes) goes through any SMTP account, e.g. a Gmail
 * address with an app password. Nothing is sent unless SMTP_USER and SMTP_PASS are set.
 */
export const emailConfig = () => {
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, '')
  if (!user || !pass) return null
  const port = Number(process.env.SMTP_PORT) || 465
  return {
    host: process.env.SMTP_HOST?.trim() || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: { user, pass },
    from: process.env.EMAIL_FROM?.trim() || user,
    fromName: process.env.EMAIL_FROM_NAME?.trim() || 'BOSS Today',
  }
}
