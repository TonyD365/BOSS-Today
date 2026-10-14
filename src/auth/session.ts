import { jwtVerify } from 'jose'
import { rankOf } from '../access'
import { JWT_AUTH_VERSION, jwtSign, type AuthStrategy, type Payload } from 'payload'

export const SESSION_SECONDS = 60 * 60 * 24 * 7

export const sessionCookieName = (payload: Payload) => `${payload.config.cookiePrefix}-token`

export const signSession = async (payload: Payload, userId: number | string) => {
  const { token } = await jwtSign({
    fieldsToSign: { id: userId, collection: 'users' },
    secret: payload.secret,
    tokenExpiration: SESSION_SECONDS,
  })
  return token
}

const readCookie = (headers: Headers, name: string): string | null => {
  const header = headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

/** Rejects cookie auth on requests that another site initiated. */
const isSameOrigin = (headers: Headers): boolean => {
  const origin = headers.get('origin')
  if (!origin) return true
  const host = headers.get('x-forwarded-host') ?? headers.get('host')
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/**
 * Staff sign in with Google (see app/(frontend)/auth/google). This strategy
 * turns the session cookie issued there back into a Payload user.
 */
export const googleSessionStrategy: AuthStrategy = {
  name: 'google-session',
  authenticate: async ({ headers, payload }) => {
    try {
      const token = readCookie(headers, sessionCookieName(payload))
      if (!token || !isSameOrigin(headers)) return { user: null }

      const { payload: claims, protectedHeader } = await jwtVerify(
        token,
        new TextEncoder().encode(payload.secret),
        { algorithms: ['HS256'] },
      )
      if (protectedHeader.authVersion !== JWT_AUTH_VERSION) return { user: null }
      if (claims.collection !== 'users') return { user: null }
      if (typeof claims.id !== 'number' && typeof claims.id !== 'string') return { user: null }

      const user = await payload.findByID({
        collection: 'users',
        id: claims.id,
        depth: 0,
        disableErrors: true,
      })
      if (!user) return { user: null }
      // Deactivated people keep their bylines but lose access straight away.
      if (rankOf(user) < 0) return { user: null }

      return { user: { ...user, collection: 'users', _strategy: 'google-session' } }
    } catch {
      return { user: null }
    }
  },
}
