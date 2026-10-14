import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { RANK, rankOf } from '@/access'
import { hashCode, isSameOrigin, MAX_ATTEMPTS, sameHash } from '@/auth/emailCode'
import { googleConfig } from '@/auth/google'
import { SESSION_SECONDS, sessionCookieName, signSession } from '@/auth/session'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200) => NextResponse.json(body, { status })
const INVALID = { message: 'That code is wrong or has expired. Request a new one.' }

const CLEARED = {
  loginCodeHash: null,
  loginCodeExpiresAt: null,
  loginCodeAttempts: 0,
}

/** POST /auth/email/verify { email, code } — exchanges a valid code for a session. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ message: 'Bad request.' }, 400)

  const body = (await request.json().catch(() => ({}))) as { email?: unknown; code?: unknown }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const code = typeof body.code === 'string' ? body.code.replace(/\D/g, '') : ''
  if (!email || code.length !== 6) return json(INVALID, 400)

  const payload = await getPayload({ config })
  const found = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    showHiddenFields: true,
  })
  const user = found.docs[0]
  if (!user?.loginCodeHash || !user.loginCodeExpiresAt) return json(INVALID, 400)

  const expired = new Date(user.loginCodeExpiresAt).getTime() < Date.now()
  const attempts = user.loginCodeAttempts ?? 0
  if (expired || attempts >= MAX_ATTEMPTS) {
    await payload.update({
      collection: 'users',
      id: user.id,
      data: CLEARED,
      context: { skipRevalidate: true },
    })
    return json(INVALID, 400)
  }

  if (!sameHash(hashCode(payload.secret, email, code), user.loginCodeHash)) {
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { loginCodeAttempts: attempts + 1 },
      context: { skipRevalidate: true },
    })
    return json(INVALID, 400)
  }

  await payload.update({
    collection: 'users',
    id: user.id,
    data: CLEARED,
    context: { skipRevalidate: true },
  })

  const isSuperAdmin = googleConfig().superAdminEmails.includes(email)
  if (user.active === false && !isSuperAdmin) {
    return json({ message: 'This account has been deactivated.' }, 403)
  }

  const response = json({ ok: true, redirect: rankOf(user) >= RANK.reporter ? '/admin' : '/' })
  response.cookies.set(sessionCookieName(payload), await signSession(payload, user.id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_SECONDS,
  })
  return response
}
