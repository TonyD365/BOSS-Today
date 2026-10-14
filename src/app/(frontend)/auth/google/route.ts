import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'

import { googleConfig, siteOrigin, STATE_COOKIE } from '@/auth/google'

export const dynamic = 'force-dynamic'

export function GET(request: Request) {
  const { clientId, allowedDomains } = googleConfig()
  const origin = siteOrigin(request)
  if (!clientId) {
    return NextResponse.redirect(`${origin}/admin/login?error=not-configured`)
  }

  const state = randomBytes(24).toString('hex')
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  })
  // A hint only — the callback enforces the domain.
  if (allowedDomains.length === 1) params.set('hd', allowedDomains[0])

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  )
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/auth/google',
    maxAge: 600,
  })
  return response
}
