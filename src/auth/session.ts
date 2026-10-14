import { randomUUID } from 'crypto'
import { jwtSign, type Payload } from 'payload'

export const SESSION_SECONDS = 60 * 60 * 24 * 7

export const sessionCookieName = (payload: Payload) => `${payload.config.cookiePrefix}-token`

type Session = { id: string; createdAt: string | Date; expiresAt: string | Date }

/**
 * Starts a session the same way Payload's password login does (a session row plus
 * a token that names it), so Google sign-ins can be signed out and revoked too.
 */
export const signSession = async (
  payload: Payload,
  user: { id: number | string; email?: string | null },
) => {
  const now = new Date()
  const sid = randomUUID()
  const current = (await payload.db.findOne({
    collection: 'users',
    where: { id: { equals: user.id } },
  })) as { sessions?: Session[] } | null
  const sessions = (current?.sessions ?? []).filter((session) => new Date(session.expiresAt) > now)
  sessions.push({
    id: sid,
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_SECONDS * 1000),
  })
  await payload.db.updateOne({
    collection: 'users',
    id: user.id,
    data: { sessions },
    returning: false,
  })

  const { token } = await jwtSign({
    fieldsToSign: { id: user.id, collection: 'users', email: user.email, sid },
    secret: payload.secret,
    tokenExpiration: SESSION_SECONDS,
  })
  return token
}
