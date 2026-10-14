import config from '@payload-config'
import { timingSafeEqual } from 'crypto'
import { decodeJwt } from 'jose'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { googleConfig, siteOrigin, STATE_COOKIE } from '@/auth/google'
import { SESSION_SECONDS, sessionCookieName, signSession } from '@/auth/session'

export const dynamic = 'force-dynamic'

const sameState = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

export async function GET(request: Request) {
  const origin = siteOrigin(request)
  const fail = (reason: string) => {
    const response = NextResponse.redirect(`${origin}/admin/login?error=${reason}`)
    response.cookies.delete({ name: STATE_COOKIE, path: '/auth/google' })
    return response
  }

  const { clientId, clientSecret, adminEmails, allowedDomains } = googleConfig()
  if (!clientId || !clientSecret) return fail('not-configured')

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const expectedState = (await cookies()).get(STATE_COOKIE)?.value
  if (!code || !state || !expectedState || !sameState(state, expectedState)) {
    return fail('sign-in-failed')
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${origin}/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  })
  if (!tokenResponse.ok) return fail('sign-in-failed')

  // The ID token comes straight from Google over TLS, so its claims are trusted
  // once the issuer and audience are confirmed.
  const { id_token: idToken } = (await tokenResponse.json()) as { id_token?: string }
  if (!idToken) return fail('sign-in-failed')
  const claims = decodeJwt(idToken)
  const issuerOk =
    claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com'
  if (!issuerOk || claims.aud !== clientId) return fail('sign-in-failed')

  const email = typeof claims.email === 'string' ? claims.email.toLowerCase() : ''
  if (!email || claims.email_verified !== true) return fail('sign-in-failed')

  const domain = email.split('@')[1] ?? ''
  if (allowedDomains.length > 0 && !allowedDomains.includes(domain)) {
    return fail('wrong-domain')
  }

  const payload = await getPayload({ config })
  const googleId = String(claims.sub)
  const name = typeof claims.name === 'string' && claims.name ? claims.name : email.split('@')[0]

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
  })
  let user = existing.docs[0]

  if (!user) {
    // Sign-in is invite-only: unknown people are turned away, not stored.
    if (!adminEmails.includes(email)) return fail('not-invited')
    user = await payload.create({
      collection: 'users',
      data: { email, name, role: 'admin', googleId },
    })
  } else if (!user.googleId) {
    user = await payload.update({
      collection: 'users',
      id: user.id,
      data: { googleId },
    })
  } else if (user.googleId !== googleId) {
    return fail('sign-in-failed')
  }

  const token = await signSession(payload, user.id)
  const response = NextResponse.redirect(`${origin}/admin`)
  response.cookies.delete({ name: STATE_COOKIE, path: '/auth/google' })
  response.cookies.set(sessionCookieName(payload), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_SECONDS,
  })
  return response
}
