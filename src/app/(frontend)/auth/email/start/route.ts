import config from '@payload-config'
import { getPayload } from 'payload'

import {
  CODE_MINUTES,
  EMAIL_PATTERN,
  hashCode,
  isSameOrigin,
  newCode,
  RESEND_SECONDS,
} from '@/auth/emailCode'
import { googleConfig } from '@/auth/google'
import { emailConfig } from '@/lib/email'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200) => Response.json(body, { status })

/** The same answer whether or not the address is on the staff list. */
const SENT = {
  ok: true,
  message:
    'If that address is on the staff list, a 6-digit code is on its way. Check your inbox and spam folder.',
}

/** POST /auth/email/start { email } — emails a one-time sign-in code to invited staff. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ message: 'Bad request.' }, 400)

  const body = (await request.json().catch(() => ({}))) as { email?: unknown }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!EMAIL_PATTERN.test(email) || email.length > 200) {
    return json({ message: 'Enter a valid email address.' }, 400)
  }

  const { superAdminEmails, allowedDomains } = googleConfig()
  const isSuperAdmin = superAdminEmails.includes(email)
  const domain = email.split('@')[1] ?? ''
  if (!isSuperAdmin && allowedDomains.length > 0 && !allowedDomains.includes(domain)) {
    return json({ message: 'Use your school email (@gapps.yrdsb.ca or @yrdsb.ca).' }, 400)
  }

  const mail = emailConfig()
  if (!mail && process.env.NODE_ENV === 'production') {
    return json({ message: 'Email sign-in has not been set up yet.' }, 503)
  }

  const payload = await getPayload({ config })
  const found = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    showHiddenFields: true,
  })
  let user = found.docs[0]

  if (!user) {
    // Invite-only: unknown addresses get the same reply and nothing is stored.
    if (!isSuperAdmin) return json(SENT)
    user = await payload.create({
      collection: 'users',
      data: { email, name: email.split('@')[0], role: 'exec' },
      context: { skipRevalidate: true },
    })
  }
  if (user.active === false && !isSuperAdmin) return json(SENT)

  const lastSent = user.loginCodeSentAt ? new Date(user.loginCodeSentAt).getTime() : 0
  if (Date.now() - lastSent < RESEND_SECONDS * 1000) return json(SENT)

  const code = newCode()
  await payload.update({
    collection: 'users',
    id: user.id,
    data: {
      loginCodeHash: hashCode(payload.secret, email, code),
      loginCodeExpiresAt: new Date(Date.now() + CODE_MINUTES * 60_000).toISOString(),
      loginCodeAttempts: 0,
      loginCodeSentAt: new Date().toISOString(),
    },
    context: { skipRevalidate: true },
  })

  try {
    await payload.sendEmail({
      to: email,
      subject: `${code} is your BOSS Today sign-in code`,
      text: `Your BOSS Today sign-in code is ${code}.\n\nIt expires in ${CODE_MINUTES} minutes. If you did not ask for it, you can ignore this email.`,
      html: `<p>Your BOSS Today sign-in code is</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>It expires in ${CODE_MINUTES} minutes. If you did not ask for it, you can ignore this email.</p>`,
    })
  } catch (error) {
    payload.logger.error({ err: error, msg: 'Could not send sign-in code' })
    return json({ message: 'The code could not be sent. Try again in a minute.' }, 502)
  }

  return json(SENT)
}
